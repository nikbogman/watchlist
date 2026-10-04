import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api, parseResponse } from '@/api'

export type MovieSummary = InferResponseType<typeof api.api.search.$get, 200>[number]

/** TMDB search, idle while q is empty. */
export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => parseResponse(api.api.search.$get({ query: { q } })),
    enabled: q.length > 0,
  })
}
