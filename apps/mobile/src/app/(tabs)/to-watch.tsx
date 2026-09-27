import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native'

import type { Status } from 'server/src/collection/collection'

import { api, parseResponse } from '@/api'
import { EmptyList } from '@/components/empty-list'
import { MovieRow } from '@/components/movie-row'
import { ScreenHeader } from '@/components/screen-header'
import { colors, fonts } from '@/theme'

const status: Status = 'to_watch'

export default function ToWatch() {
  const toWatch = useQuery({
    queryKey: ['collection', status],
    queryFn: () => parseResponse(api.api.collection.$get({ query: { status } })),
  })

  return (
    <>
      <ScreenHeader title="To watch" logout />
      {toWatch.isPending ? (
        <ActivityIndicator style={styles.center} color={colors.muted} />
      ) : toWatch.isError ? (
        <Text style={styles.message}>Couldn't load your list. Try again in a moment.</Text>
      ) : toWatch.data.length === 0 ? (
        <EmptyList text="Nothing to watch yet." />
      ) : (
        <FlatList data={toWatch.data} keyExtractor={(m) => String(m.tmdbId)} renderItem={({ item }) => <MovieRow movie={item} />} />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  message: { padding: 20, fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center' },
})
