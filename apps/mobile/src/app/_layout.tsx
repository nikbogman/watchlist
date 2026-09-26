import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold'
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular'
import { InstrumentSans_500Medium } from '@expo-google-fonts/instrument-sans/500Medium'
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { authClient } from '@/auth-client'
import { colors } from '@/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  })
  const { data: session, isPending } = authClient.useSession()
  const ready = (fontsLoaded || !!fontError) && !isPending

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  )
}
