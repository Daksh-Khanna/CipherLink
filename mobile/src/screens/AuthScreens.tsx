import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Routes } from '../navigation';
import { useSession } from '../context/Session';
import { Button, ErrorText, Field } from '../components/UI';
import { errorMessage } from '../services/client';
import { colors, styles } from '../theme';
export function WelcomeScreen({ navigation }: NativeStackScreenProps<Routes, 'Welcome'>) {
  const { server, setServer } = useSession();
  const [url, setUrl] = useState(server); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const proceed = async (target: 'Login' | 'Register') => { setBusy(true); try { await setServer(url); setError(''); navigation.navigate(target); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  return <ScrollView style={styles.screen} contentContainerStyle={{ ...styles.content, flexGrow: 1, justifyContent: 'space-between' }} keyboardShouldPersistTaps="handled"><View style={{ paddingTop: 50, gap: 30 }}><View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#24453E', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="shield-checkmark-outline" size={44} color={colors.accent} /></View><Text style={styles.label}>YOUR WORDS. YOUR WORLD.</Text><Text style={{ ...styles.title, fontSize: 52, lineHeight: 57 }}>Stay close.{`\n`}Stay private.</Text><Text style={styles.subtitle}>Meet CipherLink. Encrypted conversations and real connections, in a space that belongs to you.</Text></View><View style={{ gap: 15, marginTop: 38 }}><Text style={styles.label}>CipherLink server</Text><Field accessibilityLabel="Server address" placeholder="http://192.168.1.5:3000" value={url} onChangeText={setUrl} keyboardType="url" autoCorrect={false} /><Text style={{ ...styles.subtitle, fontSize: 12 }}>{url.startsWith('http:') ? 'Trusted LAN mode · Login traffic uses unencrypted HTTP.' : 'Connect to your configured HTTPS backend.'}</Text><ErrorText text={error} /><Button title="Create an account" loading={busy} onPress={() => void proceed('Register')} /><Button title="I already have an account" secondary onPress={() => void proceed('Login')} /><Text style={{ ...styles.subtitle, textAlign: 'center', fontSize: 12, marginVertical: 12 }}>Private by design. Connected by CipherLink.</Text></View></ScrollView>;
}
export function AuthScreen({ navigation, route }: NativeStackScreenProps<Routes, 'Login' | 'Register'>) {
  const registering = route.name === 'Register';
  const { login } = useSession();
  const [username, setUsername] = useState(''); const [display, setDisplay] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [visible, setVisible] = useState(false);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) { setError('Use 3–24 letters, numbers or underscores for your username.'); return; }
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (registering && (password !== confirm || !display.trim())) { setError(password !== confirm ? 'Passwords do not match.' : 'Enter your display name.'); return; }
    setLoading(true); setError('');
    try { await login(username, password, registering ? display : undefined); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  };
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ ...styles.content, paddingTop: 30 }}><Text style={styles.label}>CIPHERLINK / {registering ? 'GET STARTED' : 'WELCOME BACK'}</Text><Text style={styles.title}>{registering ? 'Your private space\nstarts here.' : 'Good to have\nyou back.'}</Text><Text style={styles.subtitle}>{registering ? 'Your encryption identity is created on this device. Keep the app installed to preserve access to your messages.' : 'Sign in on the device where you created your account.'}</Text><View style={{ gap: 14, marginTop: 12 }}>{registering && <Field accessibilityLabel="Display name" placeholder="Display name" value={display} onChangeText={setDisplay} autoCapitalize="words" maxLength={60} />}<Field accessibilityLabel="Username" placeholder="Username" value={username} onChangeText={setUsername} autoCorrect={false} maxLength={24} /><View style={{ gap: 8 }}><Field accessibilityLabel="Password" placeholder="Password · 10+ characters" secureTextEntry={!visible} value={password} onChangeText={setPassword} autoComplete={registering ? 'new-password' : 'current-password'} /><Pressable accessibilityRole="button" onPress={() => setVisible(!visible)} style={{ alignSelf: 'flex-end', padding: 6 }}><Text style={{ color: colors.accent }}>{visible ? 'Hide password' : 'Show password'}</Text></Pressable></View>{registering && <Field accessibilityLabel="Confirm password" placeholder="Confirm password" secureTextEntry={!visible} value={confirm} onChangeText={setConfirm} />}<ErrorText text={error} /><Button title={registering ? 'Create secure account' : 'Sign in'} loading={loading} onPress={() => void submit()} /><Button title={registering ? 'Already registered? Sign in' : 'New here? Create account'} secondary onPress={() => navigation.replace(registering ? 'Login' : 'Register')} /></View></ScrollView></KeyboardAvoidingView>;
}
