import { initTRPC } from '@trpc/server'

import { WatcherEvents } from '../lib/watcher.js'
import { Emitter } from '../types.js'

// You can use any variable name you like.
// We use t to keep things simple.
const t = initTRPC
	.context<{ getApps: () => any; watcher: Emitter<WatcherEvents> }>()
	.create()

export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure
