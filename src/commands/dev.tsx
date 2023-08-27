import type { Program } from '../program.js'

export const dev = (program: Program): void => {
	program.command(
		'dev',
		'Start a local development',
		(yargs) => yargs,
		async () => {
			const React = await import('react')
			const { createHttpTerminator } = await import('http-terminator')
			const { render } = await import('ink')

			const { linkNodeModulesToTmpDir, prepareTmpFolder } = await import(
				'../lib/utils.js'
			)
			const { Dev } = await import('../ui/dev.js')
			const { createServer } = await import('../api/server.js')
			const { createCdkWatcher } = await import('../lib/cdkWatcher.js')
			const { createSpinner } = await import('../spinner.js')
			const { createAppWatcher } = await import('../lib/appWatcher.js')

			const tmpDir = await prepareTmpFolder()
			await linkNodeModulesToTmpDir(tmpDir)

			const cdkWatcher = await createCdkWatcher({ tmpDir })

			const appWatcher = await createAppWatcher({
				cdkEmitter: cdkWatcher.cdkEmitter
			})

			const { httpServer, wsServer, apiEmitter } = await createServer({
				appEmitter: appWatcher.appEmitter
			})
			const serverTerminator = createHttpTerminator({
				server: httpServer
			})

			const app = render(
				<Dev
					apiEmitter={apiEmitter}
					cdkEmitter={cdkWatcher.cdkEmitter}
					appEmitter={appWatcher.appEmitter}
					httpServer={httpServer}
					wsServer={wsServer}
					rebuild={appWatcher.rebuild}
				/>
			)
			await app.waitUntilExit()
			app.clear()

			const spinner = createSpinner({
				text: 'Shutting down'
			}).start()

			// Cleanup
			spinner.text = 'Shutting down tRPC HTTP server'
			await serverTerminator.terminate()
			spinner.text = 'Shutting down tRPC WebSocket server'
			wsServer.close()
			wsServer.clients.forEach((client) => client.close())
			spinner.text = 'Shutting down file watcher'
			cdkWatcher.close()
			spinner.text = 'Shutting down app watcher'
			appWatcher.close()

			spinner.stop()

			// process.exit(0)
		}
	)
}
