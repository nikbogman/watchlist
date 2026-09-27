import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native'

import type { Filter } from 'server/src/collection/collection'

import { api, parseResponse } from '@/api'
import { EmptyList } from '@/components/empty-list'
import { MovieRow } from '@/components/movie-row'
import { ScreenHeader } from '@/components/screen-header'
import { colors, fonts } from '@/theme'

/** A tab listing the collection filtered by Status or Favourite. */
export function CollectionList({ title, filter, empty }: { title: string; filter: Filter; empty: string }) {
  const list = useQuery({
    queryKey: ['collection', filter],
    queryFn: () =>
      parseResponse(api.api.collection.$get({ query: 'status' in filter ? { status: filter.status } : { favourite: 'true' } })),
  })

  return (
    <>
      <ScreenHeader title={title} logout />
      {list.isPending ? (
        <ActivityIndicator style={styles.center} color={colors.muted} />
      ) : list.isError ? (
        <Text style={styles.message}>Couldn't load your list. Try again in a moment.</Text>
      ) : list.data.length === 0 ? (
        <EmptyList text={empty} />
      ) : (
        <FlatList data={list.data} keyExtractor={(m) => String(m.tmdbId)} renderItem={({ item }) => <MovieRow movie={item} />} />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  message: { padding: 20, fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center' },
})
