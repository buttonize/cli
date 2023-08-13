import type * as ts from 'typescript'

import type { Program } from '../program.js'

export const dev = (program: Program) =>
	program.command(
		'dev',
		'Start a local development',
		(yargs) => yargs,
		async (args) => {
			console.log(args)
			const { Colors } = await import('../colors.js')
			const { fork } = await import('child_process')
			const path = await import('path')
			const { watcher } = await import('../lib/watcher.js')
			const { linkNodeModulesToTmpDir, prepareTmpFolder } = await import(
				'../lib/utils.js'
			)

			const tmpDir = await prepareTmpFolder()
			await linkNodeModulesToTmpDir(tmpDir)

			Colors.line(Colors.bold('TMP DIR'), Colors.dim(tmpDir))

			const doStuff = async (): Promise<void> => {
				console.time('timeris')
				const forked = fork(
					path.join(
						path.dirname(import.meta.url.replace('file://', '')),
						'./forked.js'
					),
					{
						silent: false,
						env: {
							...process.env,
							CDK_CONTEXT_JSON: JSON.stringify({
								// To prevent CDK from building the code assets
								// https://github.com/aws/aws-cdk/issues/18125#issuecomment-1359694521
								'aws:cdk:bundling-stacks': []
							})
						}
					}
				)

				forked.on('message', (message) => {
					const tempalte = JSON.parse(`${message}`)
					console.log(Object.keys(tempalte.Resources))
					console.timeEnd('timeris')
					forked.kill()
				})

				forked.send(JSON.stringify({ tmpDir }))
			}

			const importedTs = (
				await import(
					path.join(
						tmpDir,
						'node_modules',
						'typescript',
						'lib',
						'typescript.js'
					)
				)
			).default as typeof ts

			const formatHost: ts.FormatDiagnosticsHost = {
				getCanonicalFileName: (path) => path,
				getCurrentDirectory: importedTs.sys.getCurrentDirectory,
				getNewLine: () => importedTs.sys.newLine
			}

			watcher({
				tmpDir,
				onBeforeCompilation() {
					console.log("** We're about to create the program! **")
				},
				async onRecompiled() {
					console.log('** We finished making the program! **')

					await doStuff()
				},
				onError: (diagnostic: ts.Diagnostic) => {
					Colors.line(
						Colors.dim(
							Colors.bold('TSC Error:'),
							diagnostic.code,
							':',
							importedTs.flattenDiagnosticMessageText(
								diagnostic.messageText,
								formatHost.getNewLine()
							)
						)
					)
				},
				onWatchStatusChange: (diagnostic: ts.Diagnostic) => {
					Colors.line(
						Colors.dim(
							Colors.bold('TSC Info:'),
							importedTs.formatDiagnostic(diagnostic, formatHost)
						)
					)
				}
			})
		}
	)
