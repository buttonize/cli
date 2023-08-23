import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { Server } from 'http'
import { WebSocketServer } from 'ws'

import { WatcherEvents } from '../lib/watcher.js'
import { Emitter } from '../types.js'
import { httpRouter } from './_http.js'
import { wsRouter } from './_ws.js'

export const createServer = (
	watcher: Emitter<WatcherEvents>
): {
	httpServer: Server
	wsServer: WebSocketServer
} => {
	let apps: any

	const getApps = (): any => {
		return apps
	}

	watcher.on('builtApps', (event) => {
		apps = event.apps
	})

	const httpServer = createHTTPServer({
		router: httpRouter,
		createContext() {
			// console.log('context 3')
			return {
				getApps,
				watcher
			}
		}
	})
	httpServer.listen(2022)

	const wss = new WebSocketServer({
		port: 3001
	})
	applyWSSHandler({
		wss,
		router: wsRouter,
		createContext() {
			// console.log('context 3')
			return {
				getApps,
				watcher
			}
		}
	})
	wss.on('connection', (ws) => {
		// console.log(`➕➕ Connection (${wss.clients.size})`)
		ws.once('close', () => {
			// console.log(`➖➖ Connection (${wss.clients.size})`)
		})
	})

	return {
		httpServer: httpServer.server,
		wsServer: wss
	}
}
