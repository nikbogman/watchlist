import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api, parseResponse } from '@/api'

// Types come from the API's responses, so the app depends on the contract rather than the server's internals.
const movieEndpoint = api.api.movies[':tmdbId'].$get
const entryEndpoint = api.api.collection[':tmdbId']
export type Status = NonNullable<InferResponseType<typeof movieEndpoint, 200>['status']>
/** To watch and Watched are the Collection filtered by Status, Favourites by Favourite. */
export type Filter = { status: Status } | { favourite: true }
/** `title` filters by title; newest first unless oldestFirst. */
export type Page = { title: string; oldestFirst: boolean }

// Every query key lives here, so cache updates can't miss one.
const keys = {
  movie: (tmdbId: string) => ['movie', tmdbId] as const,
  lists: ['collection'] as const,
  list: (filter: Filter, page: Page) => ['collection', filter, page] as const,
}

/** A movie with its Entry: Status, Favourite and Watched date. */
export function useMovie(tmdbId: string) {
  return useQuery({
    queryKey: keys.movie(tmdbId),
    queryFn: () => parseResponse(movieEndpoint({ param: { tmdbId } })),
  })
}

type EntryChange = { status: Status | null } | { favourite: boolean }

/**
 * Sets a movie's Status (null drops it) or Favourite. One mutation for both, so callers can block every change while one saves.
 * On success the movie shows the server's Entry and every Collection list reloads.
 * onError sits on the mutation, not on mutate, so it still fires if the screen unmounts mid-save.
 */
export function useSetEntry(tmdbId: string, { onError }: { onError: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: EntryChange) =>
      parseResponse(
        'status' in change
          ? entryEndpoint.status.$put({ param: { tmdbId }, json: change })
          : entryEndpoint.favourite.$put({ param: { tmdbId }, json: change }),
      ),
    onSuccess: (entry) => {
      queryClient.setQueryData(keys.movie(tmdbId), (old: InferResponseType<typeof movieEndpoint, 200> | undefined) => old && { ...old, ...entry })
      queryClient.invalidateQueries({ queryKey: keys.lists })
    },
    onError,
  })
}

/** A Collection list, a page at a time. */
export function useCollectionList(filter: Filter, page: Page) {
  return useInfiniteQuery({
    queryKey: keys.list(filter, page),
    queryFn: ({ pageParam }) =>
      parseResponse(
        api.api.collection.$get({
          query: {
            ...('status' in filter ? { status: filter.status } : { favourite: 'true' }),
            title: page.title,
            order: page.oldestFirst ? 'oldest' : 'newest',
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
