import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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
  const [titleSearch, setTitleSearch] = useState('')
  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setTitleSearch(text.trim()), 250)
    return () => clearTimeout(timer)
  }, [text])

  const list = useInfiniteQuery({
    queryKey: ['collection', filter, titleSearch, oldestFirst],
    queryFn: ({ pageParam }) =>
      parseResponse(
        api.api.collection.$get({
          query: {
            ...('status' in filter ? { status: filter.status } : { favourite: 'true' }),
            title: titleSearch,
            order: oldestFirst ? 'oldest' : 'newest',
            offset: String(pageParam),
          },
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    // Keeps the list on screen while a new search or sort loads.
    placeholderData: keepPreviousData,
  })

  const first = list.data?.pages[0]
  const movies = list.data?.pages.flatMap((p) => p.movies) ?? []

  return (
    <>
      <ScreenHeader
        title={title}
        count={first?.total ? (titleSearch ? `${first.matching} of ${first.total}` : String(first.total)) : undefined}
        logout
      />
      {list.isPending ? (
        <ActivityIndicator style={styles.center} color={colors.muted} />
      ) : list.isError ? (
        <Text style={styles.message}>Couldn't load your list. Try again in a moment.</Text>
      ) : list.data.pages[0].total === 0 ? (
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
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
            onEndReachedThreshold={0.5}
            ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={styles.more} color={colors.muted} /> : null}
            ListEmptyComponent={<Text style={styles.message}>No movies match “{titleSearch}”.</Text>}
          />
        </>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  more: { paddingVertical: 20 },
  message: { padding: 20, fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center' },
  sort: { alignSelf: 'flex-end', marginRight: 20, marginTop: -4, marginBottom: 8 },
  sortText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent },
})
