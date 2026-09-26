import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { api, parseResponse } from '@/api'
import { MovieRow } from '@/components/movie-row'
import { ScreenHeader } from '@/components/screen-header'
import { colors, fonts } from '@/theme'

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export default function Search() {
  const [text, setText] = useState('')
  const q = useDebounced(text.trim(), 300)
  const search = useQuery({
    queryKey: ['search', q],
    queryFn: () => parseResponse(api.api.search.$get({ query: { q } })),
    enabled: q.length > 0,
  })

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Search" />
      <View style={styles.field}>
        <Svg style={styles.icon} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth={1.8} strokeLinecap="round">
          <Circle cx={11} cy={11} r={7} />
          <Path d="M20 20l-4-4" />
        </Svg>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Movie title"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search movies by title"
        />
      </View>
      {search.isError ? (
        <Text style={styles.message}>Couldn't search right now. Try again in a moment.</Text>
      ) : (
        <FlatList
          data={q ? search.data : []}
          keyExtractor={(m) => String(m.tmdbId)}
          renderItem={({ item }) => <MovieRow movie={item} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={q && search.isSuccess ? <Text style={styles.message}>No movies match “{q}”.</Text> : null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  field: { marginHorizontal: 20, marginBottom: 16, justifyContent: 'center' },
  icon: { position: 'absolute', left: 14, zIndex: 1 },
  input: {
    height: 48,
    paddingLeft: 44,
    paddingRight: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  message: { padding: 20, fontFamily: fonts.regular, fontSize: 16, color: colors.muted, textAlign: 'center' },
})
