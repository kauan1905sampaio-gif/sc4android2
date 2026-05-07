import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/theme/colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Colors.surface },
          headerTintColor:  Colors.onDark,
          headerTitleStyle: { fontWeight: '700', letterSpacing: 0.5 },
          contentStyle:     { backgroundColor: Colors.background },
          animation:        'slide_from_right',
        }}
      />
    </>
  );
}
