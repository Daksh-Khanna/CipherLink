import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './src/context/Session';
import { CallProvider } from './src/webrtc/CallProvider';
import { CallScreen } from './src/screens/CallScreen';
import { AuthScreen, WelcomeScreen } from './src/screens/AuthScreens';
import { HomeScreen } from './src/screens/HomeScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import type { Routes } from './src/navigation';
import { colors } from './src/theme';
const Stack = createNativeStackNavigator<Routes>();
function Navigation() {
  const { session } = useSession();
  return (
    <CallProvider>
      <NavigationContainer
        theme={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            primary: colors.accent,
            background: colors.bg,
            card: colors.bg,
            text: colors.text,
            border: colors.line,
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          {session ? (
            <Stack.Group navigationKey="signed-in">
              <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="Discover"
                component={DiscoverScreen}
                options={{ title: 'New conversation' }}
              />
              <Stack.Screen name="Conversation" component={ConversationScreen} />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Your space' }}
              />
            </Stack.Group>
          ) : (
            <Stack.Group navigationKey="signed-out">
              <Stack.Screen
                name="Welcome"
                component={WelcomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen name="Login" component={AuthScreen} options={{ title: '' }} />
              <Stack.Screen name="Register" component={AuthScreen} options={{ title: '' }} />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <CallScreen />
    </CallProvider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
