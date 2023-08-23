import { observable } from '@trpc/server/observable'

import { WatcherEvents } from '../lib/watcher.js'
import { publicProcedure, router } from './trpc.js'

export const wsRouter = router({
	onGreeting: publicProcedure.subscription(({ ctx }) => {
		return observable<any>((emit) => {
			const builtApps = (event: WatcherEvents['builtApps']) => {
				emit.next(event.apps)
			}

			ctx.watcher.on('builtApps', builtApps)

			emit.next(ctx.getApps())
			// unsubscribe function when client disconnects or stops subscribing
			return () => {
				ctx.watcher.off('builtApps', builtApps)
			}
		})
	})
})

// Export only the type of a router!
// This prevents us from importing server code on the client.
export type WsRouter = typeof wsRouter
