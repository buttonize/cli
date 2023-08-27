import { initTRPC } from '@trpc/server'

import { AppWatcherEvents } from '../lib/appWatcher.js'
import { Emitter } from '../types.js'

// You can use any variable name you like.
// We use t to keep things simple.
const t = initTRPC
	.context<{ getApps: () => any; appEmitter: Emitter<AppWatcherEvents> }>()
	.create()

export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure
