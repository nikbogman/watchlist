import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'
import type { MovieSummary } from 'server/src/tmdb'

import { colors, fonts } from '@/theme'

// Muted tones for the placeholder block shown when TMDB has no poster.
const TONES = ['#4A3B2A', '#2F3A33', '#3B2F3A', '#2E3440', '#40352A', '#33302A']

export function MovieRow({ movie }: { movie: MovieSummary }) {
  return (
    <View style={styles.row}>
      {movie.posterUrl ? (
        <Image source={movie.posterUrl} style={styles.poster} transition={150} />
      ) : (
        <View style={[styles.poster, { backgroundColor: TONES[movie.tmdbId % TONES.length] }]} />
      )}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {movie.title}
        </Text>
        {movie.year !== null && <Text style={styles.year}>{movie.year}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2721',
  },
  poster: { width: 48, height: 72, borderRadius: 4 },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  year: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
})
