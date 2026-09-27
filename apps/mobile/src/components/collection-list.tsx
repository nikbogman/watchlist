import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from 'react-native'

import type { Filter } from 'server/src/collection/collection'

import { api, parseResponse } from '@/api'
import { EmptyList } from '@/components/empty-list'
import { MovieRow } from '@/components/movie-row'
import { ScreenHeader } from '@/components/screen-header'
import { SearchField } from '@/components/search-field'
import { colors, fonts } from '@/theme'

/** A tab listing the collection filtered by Status or Favourite. */
export function CollectionList({ title, filter, empty }: { title: string; filter: Filter; empty: string }) {
  const [text, setText] = useState('')
  const [oldestFirst, setOldestFirst] = useState(false)
  const list = useQuery({
    queryKey: ['collection', filter],
    queryFn: () =>
      parseResponse(api.api.collection.$get({ query: 'status' in filter ? { status: filter.status } : { favourite: 'true' } })),
  })

  // The server sends newest first, by the date the movie joined this list.
  const q = text.trim().toLowerCase()
  const matches = list.data?.filter((m) => m.title.toLowerCase().includes(q)) ?? []
  const movies = oldestFirst ? [...matches].reverse() : matches

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
        <>
          <SearchField value={text} onChangeText={setText} placeholder="Filter by title" label={`Filter ${title} by title`} />
          <Pressable
            style={styles.sort}
            onPress={() => setOldestFirst(!oldestFirst)}
            accessibilityRole="button"
            hitSlop={8}>
            <Text style={styles.sortText}>{oldestFirst ? 'Oldest first' : 'Newest first'}</Text>
          </Pressable>
          <FlatList
            // Remounts on a sort change, so the list starts at the top.
            key={String(oldestFirst)}
            data={movies}
            keyExtractor={(m) => String(m.tmdbId)}
            renderItem={({ item }) => <MovieRow movie={item} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={<Text style={styles.message}>No movies match “{text.trim()}”.</Text>}
          />
        </>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  message: { padding: 20, fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center' },
  sort: { alignSelf: 'flex-end', marginRight: 20, marginTop: -4, marginBottom: 8 },
  sortText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent },
})
