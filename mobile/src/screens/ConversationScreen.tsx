import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  decryptMessage,
  encryptMessage,
  fingerprint,
  type Envelope,
  type Message,
  type TypingEvent,
} from '@cipherlink/shared';
import type { Routes } from '../navigation';
import { useSession } from '../context/Session';
import { useCalls } from '../webrtc/CallProvider';
import { trustContact } from '../services/storage';
import { emitAck, errorMessage } from '../services/client';
import { Avatar, Empty, ErrorText, IconButton } from '../components/UI';
import { colors, styles } from '../theme';
type Bubble = {
  message: Message;
  text: string;
  state: 'sent' | 'sending' | 'failed';
  envelope?: Envelope;
};
export function ConversationScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, 'Conversation'>) {
  const conversation = route.params.conversation;
  const { session, server, online } = useSession();
  const calls = useCalls();
  const [items, setItems] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const list = useRef<FlatList<Bubble>>(null);
  const sending = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const merge = useCallback(
    (messages: Message[]) => {
      setItems((previous) => {
        const map = new Map(previous.map((m) => [m.message.id, m]));
        for (const message of messages) {
          let text: string;
          try {
            text = decryptMessage(message, session!.identity);
          } catch {
            text = 'Unable to authenticate or decrypt this message.';
          }
          map.set(message.id, { message, text, state: 'sent' });
        }
        return [...map.values()].sort(
          (a, b) =>
            a.message.createdAt.localeCompare(b.message.createdAt) ||
            a.message.id.localeCompare(b.message.id),
        );
      });
    },
    [session],
  );
  const acknowledge = useCallback(
    (messages: Message[]) => {
      for (const m of messages)
        if (m.senderId !== session!.user.id && !m.deliveredAt && session!.socket.connected)
          void emitAck(session!.socket, 'message:delivered', { id: m.id }).catch(() => {});
      void session!.api.post(`/conversations/${conversation.id}/read`).catch(() => {});
    },
    [session, conversation.id],
  );
  const verifyPeer = useCallback(async () => {
    const { data: current } = await session!.api.get(`/users/${conversation.peer.id}`);
    if (current.publicKey !== conversation.peer.publicKey)
      throw new Error(
        'Contact identity changed. Reopen the conversation and verify their fingerprint.',
      );
    await trustContact(server, session!.user.username, current.id, current.publicKey);
    setTrusted(true);
    return current;
  }, [session, server, conversation]);
  const load = useCallback(async () => {
    try {
      await verifyPeer();
      const { data } = await session!.api.get<Message[]>(
        `/conversations/${conversation.id}/messages`,
      );
      merge(data);
      setHasOlder(data.length === 50);
      acknowledge(data);
      setError('');
    } catch (e) {
      setTrusted(false);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [session, conversation.id, merge, acknowledge, verifyPeer]);
  useEffect(() => {
    void load();
    const socket = session!.socket;
    const incoming = (m: Message) => {
      if (m.conversationId === conversation.id) {
        merge([m]);
        acknowledge([m]);
        setTyping(false);
      }
    };
    const delivery = (data: { id: string; deliveredAt: string }) =>
      setItems((previous) =>
        previous.map((b) =>
          b.message.id === data.id
            ? { ...b, message: { ...b.message, deliveredAt: data.deliveredAt } }
            : b,
        ),
      );
    const typingEvent = (data: TypingEvent) => {
      if (data.conversationId === conversation.id) {
        setTyping(data.active);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 4000);
      }
    };
    socket.on('message:new', incoming);
    socket.on('message:delivery', delivery);
    socket.on('typing', typingEvent);
    socket.on('connect', load);
    return () => {
      socket.off('message:new', incoming);
      socket.off('message:delivery', delivery);
      socket.off('typing', typingEvent);
      socket.off('connect', load);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [session, conversation.id, load, merge, acknowledge]);
  const startCall = (kind: 'voice' | 'video') => {
    void verifyPeer()
      .then((peer) => calls.start(peer, kind))
      .catch((e) => Alert.alert('Call unavailable', errorMessage(e)));
  };
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() =>
            Alert.alert(
              'Contact identity fingerprint',
              `Compare this fingerprint with ${conversation.peer.displayName} through a trusted channel.\n\n${fingerprint(conversation.peer.publicKey)}`,
            )
          }
          style={{ ...styles.row, gap: 9 }}
        >
          <Avatar name={conversation.peer.displayName} size={32} />
          <View>
            <Text
              numberOfLines={1}
              style={{ color: colors.text, fontSize: 16, fontWeight: '700', maxWidth: 140 }}
            >
              {conversation.peer.displayName}
            </Text>
            <Text style={{ color: colors.accent, fontSize: 10 }}>
              {typing ? 'typing…' : 'Encrypted conversation'}
            </Text>
          </View>
        </Pressable>
      ),
      headerRight: () => (
        <View style={{ ...styles.row, gap: 8 }}>
          <IconButton name="call-outline" label="Voice call" onPress={() => startCall('voice')} />
          <IconButton
            name="videocam-outline"
            label="Video call"
            onPress={() => startCall('video')}
          />
        </View>
      ),
    });
  }, [navigation, typing, calls, conversation]);
  const transmit = async (envelope: Envelope) => {
    setItems((p) => p.map((b) => (b.message.id === envelope.id ? { ...b, state: 'sending' } : b)));
    try {
      await verifyPeer();
      const message = await emitAck<Message>(session!.socket, 'message:send', envelope);
      merge([message]);
      setError('');
    } catch (e) {
      setItems((p) => p.map((b) => (b.message.id === envelope.id ? { ...b, state: 'failed' } : b)));
      setError(errorMessage(e));
    }
  };
  const send = async () => {
    if (!draft.trim() || sending.current || !trusted) return;
    sending.current = true;
    try {
      const envelope = encryptMessage(
        draft.trim(),
        { id: randomUUID(), conversationId: conversation.id },
        session!.identity,
        conversation.peer.publicKey,
      );
      const text = draft.trim();
      setDraft('');
      setItems((p) => [
        ...p,
        {
          message: {
            ...envelope,
            senderId: session!.user.id,
            createdAt: new Date().toISOString(),
            deliveredAt: null,
          },
          text,
          envelope,
          state: 'sending',
        },
      ]);
      await transmit(envelope);
      void emitAck(session!.socket, 'typing', {
        conversationId: conversation.id,
        active: false,
      }).catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      sending.current = false;
    }
  };
  const older = async () => {
    if (!items.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { data } = await session!.api.get<Message[]>(
        `/conversations/${conversation.id}/messages`,
        { params: { before: items[0].message.id } },
      );
      merge(data);
      setHasOlder(data.length === 50);
      acknowledge(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  };
  const typingLast = useRef(0);
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
        <ErrorText text={error} />
        {!online && <Text style={styles.subtitle}>Offline · Reconnecting…</Text>}
      </View>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />
      ) : (
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(b) => b.message.id}
          contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
          onContentSizeChange={() => {
            if (!loadingOlder) list.current?.scrollToEnd({ animated: true });
          }}
          ListHeaderComponent={
            hasOlder ? (
              <Pressable onPress={() => void older()} style={{ padding: 15 }}>
                <Text style={{ color: colors.accent, textAlign: 'center' }}>
                  {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                </Text>
              </Pressable>
            ) : (
              <Text style={{ ...styles.subtitle, textAlign: 'center', fontSize: 11, padding: 15 }}>
                Only you and your contact can read these messages.
              </Text>
            )
          }
          ListEmptyComponent={
            <Empty
              title="A conversation just for you two"
              detail="Say hello. Your message is encrypted before it leaves this device."
            />
          }
          renderItem={({ item, index }) => {
            const mine = item.message.senderId === session!.user.id;
            const date = new Date(item.message.createdAt).toLocaleDateString();
            const showDate =
              index === 0 ||
              new Date(items[index - 1].message.createdAt).toLocaleDateString() !== date;
            return (
              <View>
                {showDate && (
                  <Text
                    style={{
                      ...styles.subtitle,
                      textAlign: 'center',
                      fontSize: 11,
                      marginVertical: 12,
                    }}
                  >
                    {date}
                  </Text>
                )}
                <Pressable
                  disabled={item.state !== 'failed'}
                  onPress={() => item.envelope && void transmit(item.envelope)}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    backgroundColor: mine ? '#245E4F' : colors.surface,
                    maxWidth: '86%',
                    padding: 14,
                    borderRadius: 20,
                    borderBottomRightRadius: mine ? 5 : 20,
                    borderBottomLeftRadius: mine ? 20 : 5,
                    gap: 7,
                  }}
                >
                  <Text selectable style={styles.body}>
                    {item.text}
                  </Text>
                  <Text
                    style={{
                      color: mine ? '#AAD8C8' : colors.muted,
                      fontSize: 10,
                      textAlign: 'right',
                    }}
                  >
                    {new Date(item.message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {mine
                      ? `  ${item.state === 'failed' ? 'Failed · tap to retry' : item.state === 'sending' ? 'Sending…' : item.message.deliveredAt ? '✓✓' : '✓'}`
                      : ''}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
      <View style={{ ...styles.row, padding: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
        <TextInput
          accessibilityLabel="Message"
          placeholder="Write something private…"
          placeholderTextColor={colors.muted}
          value={draft}
          multiline
          maxLength={8000}
          onChangeText={(text) => {
            setDraft(text);
            if (Date.now() - typingLast.current > 2000) {
              typingLast.current = Date.now();
              void emitAck(session!.socket, 'typing', {
                conversationId: conversation.id,
                active: !!text,
              }).catch(() => {});
            }
          }}
          style={{
            flex: 1,
            backgroundColor: colors.panel,
            padding: 15,
            borderRadius: 24,
            color: colors.text,
            fontSize: 15,
            maxHeight: 120,
          }}
        />
        <IconButton name="arrow-up" active label="Send message" onPress={() => void send()} />
      </View>
    </KeyboardAvoidingView>
  );
}
