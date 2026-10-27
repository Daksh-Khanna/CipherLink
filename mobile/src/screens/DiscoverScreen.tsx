import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { User } from '@cipherlink/shared';
import type { Routes } from '../navigation';
import { useSession } from '../context/Session';
import { Avatar, Empty, ErrorText, Field } from '../components/UI';
import { errorMessage } from '../services/client';
import { styles, colors } from '../theme';
export function DiscoverScreen({ navigation }: NativeStackScreenProps<Routes, 'Discover'>) {
  const { session } = useSession(); const [query, setQuery] = useState(''); const [users, setUsers] = useState<User[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); const timeout = setTimeout(() => { session!.api.get('/users/search', { params: { q: query }, signal: controller.signal }).then(r => { setUsers(r.data); setError(''); }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }); }, 250); return () => { clearTimeout(timeout); controller.abort(); }; }, [query, session]);
  const open = async (user: User) => { if (busy) return; setBusy(true); try { const { data } = await session!.api.post('/conversations', { userId: user.id }); navigation.replace('Conversation', { conversation: data }); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  return <View style={styles.screen}><View style={styles.content}><Text style={styles.title}>Find your people.</Text><Text style={styles.subtitle}>Search a registered username to start a private conversation.</Text><Field accessibilityLabel="Search registered users" placeholder="Search by username or name" value={query} onChangeText={setQuery} /><ErrorText text={error} /></View><FlatList data={users} keyExtractor={u => u.id} contentContainerStyle={{ padding: 24, gap: 12 }} ListEmptyComponent={<Empty title="No contacts found" detail="Ask your friend to create an account on the same CipherLink server." />} renderItem={({ item }) => <Pressable disabled={busy} onPress={() => void open(item)} style={{ ...styles.card, flexDirection: 'row', alignItems: 'center' }}><Avatar name={item.displayName} online={item.online} /><View style={{ flex: 1 }}><Text style={styles.body}>{item.displayName}</Text><Text style={styles.subtitle}>@{item.username}</Text></View><Text style={{ color: colors.accent, fontSize: 23 }}>↗</Text></Pressable>} /></View>;
}
