import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from '../src/components/layout';
import { LibraryHistoryBridge } from '../src/lib/LibraryHistoryBridge';
import { LibraryProvider } from '../src/lib/LibraryProvider';
import { StudyHistoryProvider } from '../src/lib/StudyHistoryProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <StudyHistoryProvider>
          <LibraryHistoryBridge />
          <AppShell>
            <Stack screenOptions={{ headerShown: false }} />
          </AppShell>
        </StudyHistoryProvider>
      </LibraryProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
