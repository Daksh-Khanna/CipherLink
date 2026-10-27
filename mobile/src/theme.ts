import { StyleSheet } from 'react-native';
export const colors = { bg: '#101415', panel: '#192021', surface: '#232C2D', accent: '#49B99B', text: '#F4F7F6', muted: '#9BAAA7', danger: '#EC7777', line: '#2A3535' };
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, content: { padding: 24, gap: 18 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  input: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, fontSize: 16 },
  card: { backgroundColor: colors.panel, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.line, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
});
