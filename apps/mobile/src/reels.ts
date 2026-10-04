import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api, parseResponse } from '@/api'

const reels = api.api.reels
/** A reel shared to the app, and what it was found to show. */
export type ReelRequest = InferResponseType<typeof reels.$get, 200>[number]

const key = ['reels'] as const

export const inProgress = (r: ReelRequest) => r.status === 'queued' || r.status === 'running'

/** Every request, newest first. Re-checks every 3s while any is still being identified. */
export function useRequests() {
  return useQuery({
    queryKey: key,
    queryFn: () => parseResponse(reels.$get()),
    refetchInterval: (q) => (q.state.data?.some(inProgress) ? 3000 : false),
  })
}

/** Sends a reel URL to be identified. Fails for anything that isn't an Instagram reel or post. */
export function useShareReel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => parseResponse(reels.$post({ json: { url } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Queues a failed request again. */
export function useRetry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => parseResponse(reels[':id'].retry.$post({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
