import { useQuery } from '@tanstack/react-query'
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native'

import { api, parseResponse } from '@/api'
import { EmptyList } from '@/components/empty-list'
import { MovieRow } from '@/components/movie-row'
import { ScreenHeader } from '@/components/screen-header'
import { colors, fonts } from '@/theme'

export default function ToWatch() {
  const list = useQuery({
    queryKey: ['lists', 'to-watch'],
    queryFn: () => parseResponse(api.api.lists['to-watch'].$get()),
  })

  return (
    <>
      <ScreenHeader title="To watch" logout />
      {list.isPending ? (
        <ActivityIndicator style={styles.center} color={colors.muted} />
      ) : list.isError ? (
        <Text style={styles.message}>Couldn't load your list. Try again in a moment.</Text>
      ) : list.data.length === 0 ? (
        <EmptyList text="Nothing to watch yet." />
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
