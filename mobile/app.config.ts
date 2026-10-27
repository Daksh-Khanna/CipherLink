import type { ExpoConfig } from 'expo/config';
const insecure = process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === 'true';
const config: ExpoConfig = {
  name: 'CipherLink', slug: 'cipherlink', version: '1.0.0', scheme: 'cipherlink', orientation: 'portrait',
  userInterfaceStyle: 'dark', icon: './assets/icon.png',
  android: { package: 'com.cipherlink.mobile', permissions: ['CAMERA', 'RECORD_AUDIO', 'INTERNET', 'ACCESS_NETWORK_STATE', 'MODIFY_AUDIO_SETTINGS'], adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#101415' } },
  plugins: [ 'expo-dev-client', ['expo-secure-store', { configureAndroidBackup: true }], ['expo-splash-screen', { image: './assets/icon.png', imageWidth: 140, backgroundColor: '#101415' }], '@config-plugins/react-native-webrtc', ['expo-build-properties', { android: { usesCleartextTraffic: insecure } }] ],
};
export default config;
