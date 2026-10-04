import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api, parseResponse } from '@/api'

// Types come from the API's responses, so the app depends on the contract rather than the server's internals.
const movieEndpoint = api.api.movies[':tmdbId'].$get
const entryEndpoint = api.api.collection[':tmdbId']
export type MovieSummary = InferResponseType<typeof api.api.search.$get, 200>[number]
export type Status = NonNullable<InferResponseType<typeof movieEndpoint, 200>['status']>
/** To watch and Watched are the Collection filtered by Status, Favourites by Favourite. */
export type Filter = { status: Status } | { favourite: true }

// Every query key lives here, so cache updates can't miss one.
const keys = {
  movie: (tmdbId: string) => ['movie', tmdbId] as const,
  lists: ['collection'] as const,
  list: (filter: Filter, title: string, oldestFirst: boolean) => ['collection', filter, title, oldestFirst] as const,
  search: (q: string) => ['search', q] as const,
}

/** TMDB search, idle while q is empty. */
export function useSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: () => parseResponse(api.api.search.$get({ query: { q } })),
    enabled: q.length > 0,
  })
}

/** A movie with its Entry: Status, Favourite and Watched date. */
export function useMovie(tmdbId: string) {
  return useQuery({
    queryKey: keys.movie(tmdbId),
    queryFn: () => parseResponse(movieEndpoint({ param: { tmdbId } })),
  })
}

type Change = { status: Status | null } | { favourite: boolean }

/**
 * Sets a movie's Status (null drops it) or Favourite. One mutation for both, so callers can block every change while one saves.
 * On success the movie shows the server's Entry and every Collection list reloads.
 */
export function useSetEntry(tmdbId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: Change) =>
      parseResponse(
        'status' in change
          ? entryEndpoint.status.$put({ param: { tmdbId }, json: change })
          : entryEndpoint.favourite.$put({ param: { tmdbId }, json: change }),
      ),
    onSuccess: (entry) => {
      queryClient.setQueryData(keys.movie(tmdbId), (old: InferResponseType<typeof movieEndpoint, 200> | undefined) => old && { ...old, ...entry })
      queryClient.invalidateQueries({ queryKey: keys.lists })
    },
  })
}

/** A Collection list, a page at a time. `title` filters by title; newest first unless oldestFirst. */
export function useCollectionList(filter: Filter, { title, oldestFirst }: { title: string; oldestFirst: boolean }) {
  return useInfiniteQuery({
    queryKey: keys.list(filter, title, oldestFirst),
    queryFn: ({ pageParam }) =>
      parseResponse(
        api.api.collection.$get({
          query: {
            ...('status' in filter ? { status: filter.status } : { favourite: 'true' }),
            title,
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
}
