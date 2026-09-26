import { Tabs } from 'expo-router'
import type { ReactNode } from 'react'
import type { ColorValue } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, fonts } from '@/theme'

function Icon({ color, children }: { color: ColorValue; children: ReactNode }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  )
}

export default function TabsLayout() {
  return (
    // History, so back from the movie page returns to the tab it was opened from.
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Icon color={color}>
              <Circle cx={11} cy={11} r={7} />
              <Path d="M20 20l-4-4" />
            </Icon>
          ),
        }}
      />
      <Tabs.Screen
        name="to-watch"
        options={{
          title: 'To watch',
          tabBarIcon: ({ color }) => (
            <Icon color={color}>
              <Path d="M6 4h12v17l-6-4-6 4z" />
            </Icon>
          ),
        }}
      />
      <Tabs.Screen
        name="watched"
        options={{
          title: 'Watched',
          tabBarIcon: ({ color }) => (
            <Icon color={color}>
              <Circle cx={12} cy={12} r={9} />
              <Path d="M8 12.5l2.5 2.5L16 9.5" />
            </Icon>
          ),
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: 'Favourites',
          tabBarIcon: ({ color }) => (
            <Icon color={color}>
              <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </Icon>
          ),
        }}
      />
      {/* Inside the tabs, not the root stack, so the tab bar stays visible on it. */}
      <Tabs.Screen name="movie/[tmdbId]" options={{ href: null }} />
    </Tabs>
  )
}
