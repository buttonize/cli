import cpx2 from 'cpx2'
import * as path from 'path'
import type * as ts from 'typescript'

import { Colors } from '../colors.js'

export const watcher = async ({
	tmpDir,
	onBeforeCompilation,
	onRecompiled,
	onWatchStatusChange,
	onError
}: {
	tmpDir: string
	onBeforeCompilation: () => void
	onRecompiled: () => Promise<void> | void
	onWatchStatusChange: ts.WatchStatusReporter
	onError: ts.DiagnosticReporter
}): Promise<{ close: () => void }> => {
	const importedTs = (
		await import(
			path.join(tmpDir, 'node_modules', 'typescript', 'lib', 'typescript.js')
		)
	).default as typeof ts

	let tsWatcher: ts.WatchOfConfigFile<any> | undefined

	const watchTs = (): void => {
		const tsConfigPath = importedTs.findConfigFile(
			tmpDir,
			importedTs.sys.fileExists,
			'tsconfig.json'
		)

		if (!tsConfigPath) {
			throw new Error("Could not find a valid 'tsconfig.json'.")
		}

		const host = importedTs.createWatchCompilerHost(
			tsConfigPath,
			{
				outDir: tmpDir,
				sourceMap: false,
				declaration: false
			},
			importedTs.sys,
			importedTs.createEmitAndSemanticDiagnosticsBuilderProgram,
			onError,
			onWatchStatusChange
		)

		const origCreateProgram = host.createProgram
		host.createProgram = (
			rootNames,
			options,
			host,
			oldProgram
		): ts.EmitAndSemanticDiagnosticsBuilderProgram => {
			try {
				onBeforeCompilation()
			} catch (err) {
				Colors.line(
					Colors.bold(Colors.danger(`onBeforeCompilation handler error:`))
				)
				console.error(err)
			}

			return origCreateProgram(rootNames, options, host, oldProgram)
		}

		const origPostProgramCreate = host.afterProgramCreate as Exclude<
			typeof host['afterProgramCreate'],
			undefined
		>
		host.afterProgramCreate = async (program): Promise<void> => {
			setTimeout(async () => {
				try {
					await onRecompiled()
				} catch (err) {
					Colors.line(Colors.bold(Colors.danger(`onRecompiled handler error:`)))
					console.error(err)
				}
			}, 100)

			origPostProgramCreate(program)
		}

		tsWatcher = importedTs.createWatchProgram(host)
	}

	const fsWatcher = cpx2.watch('**/*', tmpDir, {
		ignore: ['!node_modules', '!.git']
	})
	fsWatcher.on('watch-ready', () => watchTs())

	return {
		close: (): void => {
			fsWatcher.close()
			tsWatcher?.close()
		}
	}
}
