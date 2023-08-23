import cpx2 from 'cpx2'
import { EventEmitter } from 'events'
import * as path from 'path'
import type * as ts from 'typescript'

import { Colors } from '../colors.js'
import { Emitter } from '../types.js'
import { buildCdkTree, extractAppsFromStacks } from './cdk.js'
import { CdkForkedErrors, CdkForkedStacks } from './types.js'

export type WatcherEvents = {
	tsConfigError: {}
	tsError: {
		diagnostic: ts.Diagnostic
	}
	watchStatusChange: {
		diagnostic: ts.Diagnostic
		newLine: string
		options: ts.CompilerOptions
		errorCount?: number
	}
	recompiled: {}
	beforeRecompilation: {}
	builtCdkStacks: {
		stacks: CdkForkedStacks
		errors: CdkForkedErrors
	}
	builtApps: {
		apps: {
			[stackId: string]: { [appId: string]: any }
		}
	}
}

export const createWatcher = async ({
	tmpDir
}: {
	tmpDir: string
}): Promise<{ emitter: Emitter<WatcherEvents>; close: () => void }> => {
	const importedTs = (
		await import(
			path.join(tmpDir, 'node_modules', 'typescript', 'lib', 'typescript.js')
		)
	).default as typeof ts

	let tsWatcher: ts.WatchOfConfigFile<any> | undefined
	let fsWatcher: cpx2.Watcher | undefined

	const emitter = new EventEmitter() as Emitter<WatcherEvents>

	const formatHost: ts.FormatDiagnosticsHost = {
		getCanonicalFileName: (path) => path,
		getCurrentDirectory: () => tmpDir,
		getNewLine: () => importedTs.sys.newLine
	}

	const watchTs = (): void => {
		const tsConfigPath = importedTs.findConfigFile(
			tmpDir,
			importedTs.sys.fileExists,
			'tsconfig.json'
		)

		if (!tsConfigPath) {
			emitter.emit('tsConfigError', {})
			return
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
			(diagnostic) => {
				if (process.env.BTNZ_VERBOSE) {
					Colors.line(
						Colors.dim(
							Colors.bold('TSC Error:'),
							`${diagnostic.code}:${importedTs.flattenDiagnosticMessageText(
								diagnostic.messageText,
								formatHost.getNewLine()
							)}`
						)
					)
				}

				emitter.emit('tsError', { diagnostic })
			},
			(
				diagnostic: ts.Diagnostic,
				newLine: string,
				options: ts.CompilerOptions,
				errorCount?: number
			) => {
				if (process.env.BTNZ_VERBOSE) {
					Colors.line(
						Colors.dim(
							Colors.bold('TSC Info:'),
							importedTs.formatDiagnostic(diagnostic, formatHost)
						)
					)
				}

				emitter.emit('watchStatusChange', {
					diagnostic,
					newLine,
					options,
					errorCount
				})
			}
		)

		const origCreateProgram = host.createProgram
		host.createProgram = (
			rootNames,
			options,
			host,
			oldProgram
		): ts.EmitAndSemanticDiagnosticsBuilderProgram => {
			emitter.emit('beforeRecompilation', {})

			return origCreateProgram(rootNames, options, host, oldProgram)
		}

		const origPostProgramCreate = host.afterProgramCreate as Exclude<
			typeof host['afterProgramCreate'],
			undefined
		>
		host.afterProgramCreate = async (program): Promise<void> => {
			setTimeout(async () => {
				emitter.emit('recompiled', {})

				const { stacks, errors } = await buildCdkTree(tmpDir)

				emitter.emit('builtCdkStacks', { stacks, errors })

				const apps = extractAppsFromStacks(stacks)

				emitter.emit('builtApps', {
					apps
				})
			}, 100)

			origPostProgramCreate(program)
		}

		tsWatcher = importedTs.createWatchProgram(host)
	}

	fsWatcher = cpx2.watch('**/*', tmpDir, {
		ignore: ['node_modules', '.git']
	})
	fsWatcher.on('watch-ready', () => watchTs())

	return {
		emitter,
		close(): void {
			tsWatcher?.close()
			fsWatcher?.close()
		}
	}
}
