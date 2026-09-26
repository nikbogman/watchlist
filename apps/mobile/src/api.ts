import { hc } from 'hono/client'
import type { AppType } from 'server/src/app'

import { authClient } from '@/auth-client'

// The session cookie lives in secure storage, so it's added by hand rather than by fetch.
export const api = hc<AppType>(process.env.EXPO_PUBLIC_API_URL!, {
  headers: async () => ({ cookie: (await authClient.getCookie()) ?? '' }),
  init: { credentials: 'omit' },
})

export { parseResponse } from 'hono/client'
