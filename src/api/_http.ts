import { publicProcedure, router } from './trpc.js'

export const httpRouter = router({
	greeting: publicProcedure.query(({ ctx }) => JSON.stringify(ctx.getApps()))
})

// Export only the type of a router!
// This prevents us from importing server code on the client.
export type AppRouter = typeof httpRouter
