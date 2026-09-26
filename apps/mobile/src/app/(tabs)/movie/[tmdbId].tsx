import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { api, parseResponse } from '@/api'
import { Poster } from '@/components/movie-row'
import { colors, fonts } from '@/theme'

export default function Movie() {
  const { tmdbId } = useLocalSearchParams<{ tmdbId: string }>()
  const { top } = useSafeAreaInsets()
  const movie = useQuery({
    queryKey: ['movie', tmdbId],
    queryFn: () => parseResponse(api.api.movies[':tmdbId'].$get({ param: { tmdbId } })),
  })

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: top + 8, paddingHorizontal: 8 }}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      {movie.isPending ? (
        <ActivityIndicator style={styles.center} color={colors.muted} />
      ) : movie.isError ? (
        <View style={styles.center}>
          <Text style={styles.message}>Couldn't load this movie.</Text>
          <Pressable style={styles.retry} onPress={() => movie.refetch()} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <Poster movie={movie.data} style={styles.poster} />
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">
                {movie.data.title}
              </Text>
              {movie.data.year !== null && <Text style={styles.year}>{movie.data.year}</Text>}
            </View>
          </View>
          {!!movie.data.overview && <Text style={styles.overview}>{movie.data.overview}</Text>}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 44, paddingHorizontal: 12, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.medium, fontSize: 16, color: colors.accent },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  message: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center' },
  retry: { height: 44, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: colors.buttonBorder, justifyContent: 'center' },
  retryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  body: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20, gap: 24 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  poster: { width: 140, height: 210, borderRadius: 8 },
  heading: { flex: 1, gap: 6, paddingBottom: 4 },
  title: { fontFamily: fonts.title, fontSize: 30, lineHeight: 33, color: colors.text },
  year: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  overview: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: '#D6CFC2' },
})
