import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { decryptMessage, type Conversation } from '@cipherlink/shared';
import type { Routes } from '../navigation';
import { useSession } from '../context/Session';
import { Avatar, Empty, ErrorText, Field, IconButton } from '../components/UI';
import { errorMessage } from '../services/client';
import { trustContact } from '../services/storage';
import { colors, styles } from '../theme';
export function HomeScreen({ navigation }: NativeStackScreenProps<Routes, 'Home'>) {
  const { session, online, server } = useSession();
  const [chats, setChats] = useState<Conversation[]>([]); const [previews, setPreviews] = useState<Record<string, string>>({}); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const { data } = await session!.api.get<Conversation[]>('/conversations'); setChats(data); setError('');
      const entries = await Promise.all(data.map(async c => { try { await trustContact(server, session!.user.username, c.peer.id, c.peer.publicKey); return [c.id, c.lastMessage ? decryptMessage(c.lastMessage, session!.identity) : 'Start something private.']; } catch { return [c.id, 'Identity changed or message unavailable']; } }));
      setPreviews(Object.fromEntries(entries));
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [session, server]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { const socket = session!.socket; const refresh = () => void load(); socket.on('message:new', refresh); socket.on('presence', refresh); socket.on('connect', refresh); return () => { socket.off('message:new', refresh); socket.off('presence', refresh); socket.off('connect', refresh); }; }, [load, session]);
  return <View style={styles.screen}><View style={styles.content}><View style={{ ...styles.row, justifyContent: 'space-between' }}><View style={{ gap: 6 }}><Text style={styles.title}>CipherLink<Text style={{ color: colors.accent }}>.</Text></Text><Text style={styles.subtitle}>{online ? 'Connected. Keep it private.' : 'Reconnecting to your server…'}</Text></View><Pressable accessibilityLabel="Open profile" onPress={() => navigation.navigate('Profile')}><Avatar name={session!.user.displayName} size={46} /></Pressable></View><View style={styles.row}><View style={{ flex: 1 }}><Field accessibilityLabel="Search conversations" placeholder="Search your conversations" value={search} onChangeText={setSearch} /></View><IconButton name="add" active label="New conversation" onPress={() => navigation.navigate('Discover')} /></View><View style={{ ...styles.row, justifyContent: 'space-between' }}><Text style={styles.label}>CONVERSATIONS</Text><Text style={{ color: colors.accent, fontSize: 12 }}>End-to-end encrypted</Text></View><ErrorText text={error} /></View><FlatList data={chats.filter(c => `${c.peer.displayName} ${c.peer.username}`.toLowerCase().includes(search.toLowerCase()))} keyExtractor={c => c.id} refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, gap: 10 }} ListEmptyComponent={<Empty title="Make your first connection" detail="Find a friend by username and start an encrypted conversation." />} renderItem={({ item }) => <Pressable onPress={() => navigation.navigate('Conversation', { conversation: item })} style={{ ...styles.card, padding: 16, flexDirection: 'row', alignItems: 'center' }}><Avatar name={item.peer.displayName} online={item.peer.online} /><View style={{ flex: 1, gap: 6 }}><View style={{ ...styles.row, justifyContent: 'space-between' }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>{item.peer.displayName}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{item.lastMessage ? new Date(item.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text></View><View style={styles.row}><Text numberOfLines={1} style={{ ...styles.subtitle, flex: 1, fontSize: 13 }}>{previews[item.id] || 'Encrypted message'}</Text>{item.unread > 0 && <Text style={{ backgroundColor: colors.accent, color: colors.bg, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, textAlign: 'center', fontWeight: '700' }}>{item.unread}</Text>}</View></View></Pressable>} /></View>;
}
