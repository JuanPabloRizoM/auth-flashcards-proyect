import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from '../src/components/layout';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppShell>
        <Stack screenOptions={{ headerShown: false }} />
      </AppShell>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
