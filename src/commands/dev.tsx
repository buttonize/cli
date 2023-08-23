import type { Program } from '../program.js'
import { createSpinner } from '../spinner.js'

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
			const { createWatcher } = await import('../lib/watcher.js')

			const tmpDir = await prepareTmpFolder()
			await linkNodeModulesToTmpDir(tmpDir)

			const watcher = await createWatcher({ tmpDir })

			const { httpServer, wsServer } = createServer(watcher.emitter)
			const serverTerminator = createHttpTerminator({
				server: httpServer
			})

			const app = render(<Dev tmpDir={tmpDir} watcher={watcher.emitter} />)
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
			await new Promise((r) => setTimeout(r, 1000))
			spinner.text = 'Shutting down file watcher'
			watcher.close()

			spinner.stop()

			// process.exit(0)
		}
	)
}
