import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from '../src/components/layout';
import { LibraryProvider } from '../src/lib/LibraryProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <AppShell>
          <Stack screenOptions={{ headerShown: false }} />
        </AppShell>
      </LibraryProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
