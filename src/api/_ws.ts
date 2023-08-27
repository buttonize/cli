import { observable } from '@trpc/server/observable'

import { AppWatcherEvents } from '../lib/appWatcher.js'
import { publicProcedure, router } from './trpc.js'

export const wsRouter = router({
	onGreeting: publicProcedure.subscription(({ ctx }) => {
		return observable<any>((emit) => {
			const done = (event: AppWatcherEvents['done']): void => {
				emit.next(event.apps)
			}

			ctx.appEmitter.on('done', done)

			emit.next(ctx.getApps())
			// unsubscribe function when client disconnects or stops subscribing
			return (): void => {
				ctx.appEmitter.off('done', done)
			}
		})
	})
})

// Export only the type of a router!
// This prevents us from importing server code on the client.
export type WsRouter = typeof wsRouter
