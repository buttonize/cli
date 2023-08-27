import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import EventEmitter from 'events'
import getPort from 'get-port'
import { Server } from 'http'
import { WebSocketServer } from 'ws'

import { AppWatcherEvents } from '../lib/appWatcher.js'
import { Emitter } from '../types.js'
import { httpRouter } from './_http.js'
import { wsRouter } from './_ws.js'

export type ApiEvents = {
	connectionChange: {
		connectionsCount: number
	}
}

export const createServer = async ({
	appEmitter
}: {
	appEmitter: Emitter<AppWatcherEvents>
}): Promise<{
	apiEmitter: Emitter<ApiEvents>
	httpServer: Server
	wsServer: WebSocketServer
}> => {
	const apiEmitter = new EventEmitter() as Emitter<ApiEvents>

	let apps: any

	const getApps = (): any => {
		return apps
	}

	appEmitter.on('done', (event) => {
		apps = event.apps
	})

	const httpServer = createHTTPServer({
		router: httpRouter,
		createContext() {
			return {
				getApps,
				appEmitter
			}
		}
	})
	httpServer.listen(
		await getPort({ port: [3005, 3006, 3008, 3009, 3010, 3011, 3012] })
	)

	const wss = new WebSocketServer({
		port: await getPort({ port: [4005, 4006, 4008, 4009, 4010, 4011, 4012] })
	})
	applyWSSHandler({
		wss,
		router: wsRouter,
		createContext() {
			return {
				getApps,
				appEmitter
			}
		}
	})

	wss.on('connection', (socker) => {
		apiEmitter.emit('connectionChange', {
			connectionsCount: wss.clients.size
		})

		socker.on('close', () => {
			apiEmitter.emit('connectionChange', {
				connectionsCount: wss.clients.size
			})
		})
	})

	return {
		apiEmitter,
		httpServer: httpServer.server,
		wsServer: wss
	}
}
