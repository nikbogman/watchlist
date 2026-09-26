import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { authClient } from '@/auth-client'
import { colors, fonts } from '@/theme'

export function ScreenHeader({ title, logout }: { title: string; logout?: boolean }) {
  const { top } = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: top + 16 }]}>
      <Text style={styles.title}>{title}</Text>
      {logout && (
        // Signing out deletes the server session; the root guard then shows Login.
        <Pressable style={styles.logout} onPress={() => authClient.signOut()} accessibilityRole="button" accessibilityLabel="Log out">
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <Path d="M10 16l-4-4 4-4" />
            <Path d="M6 12h10" />
          </Svg>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 12, paddingBottom: 12 },
  title: { fontFamily: fonts.title, fontSize: 34, color: colors.text },
  logout: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
