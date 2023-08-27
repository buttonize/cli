import { Server } from 'http'
import { Box, Newline, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import symbols from 'log-symbols'
import { AddressInfo } from 'net'
import React, { useEffect, useState } from 'react'
import { WebSocketServer } from 'ws'

import { ApiEvents } from '../api/server.js'
import { AppWatcherEvents } from '../lib/appWatcher.js'
import { CdkWatcherEvents } from '../lib/cdkWatcher.js'
import { Emitter } from '../types.js'

type DevProps = {
	cdkEmitter: Emitter<CdkWatcherEvents>
	appEmitter: Emitter<AppWatcherEvents>
	apiEmitter: Emitter<ApiEvents>
	httpServer: Server
	wsServer: WebSocketServer
	rebuild: () => void
}

type ProgramPhases =
	| 'init'
	| 'compilingTs'
	| 'buildingCdkTree'
	| 'buildingApp'
	| 'built'

const phasesTranslations: Record<ProgramPhases, string> = {
	buildingCdkTree: 'Executing CDK code...',
	built: 'App built',
	compilingTs: 'Compiling TypeScript source files...',
	buildingApp: 'Extracting Apps from CDK and fetching resources from AWS...',
	init: 'Initializing...'
}

export const Dev: React.FC<DevProps> = ({
	apiEmitter,
	cdkEmitter,
	appEmitter,
	httpServer,
	wsServer,
	rebuild
}) => {
	const [currentPhase, setCurrentPhase] = useState<ProgramPhases>('init')

	const [errors, setErrors] = useState<string[] | undefined>()

	const [apiConnections, setApiConnections] = useState<number>(0)

	const { exit } = useApp()

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			exit()
		}
		if (key.return) {
			rebuild()
		}
	})

	// cdkEmitter
	useEffect(() => {
		const beforeRecompilation = (): void => {
			setCurrentPhase('compilingTs')
			setErrors(undefined)
		}
		const recompiled = (): void => setCurrentPhase('buildingCdkTree')

		const error = (event: CdkWatcherEvents['error']): void => {
			setErrors((currentErrors) => {
				let errs = typeof currentErrors === 'undefined' ? [] : currentErrors

				// Remove duplicates by using Set
				return [...new Set<string>([...errs, event.message])]
			})
		}

		cdkEmitter
			.on('beforeRecompilation', beforeRecompilation)
			.on('recompiled', recompiled)
			.on('error', error)
		return () => {
			cdkEmitter
				.off('beforeRecompilation', beforeRecompilation)
				.off('recompiled', recompiled)
				.on('error', error)
		}
	}, [])

	// appEmitter
	useEffect(() => {
		const done = (event: AppWatcherEvents['done']): void => {
			setCurrentPhase('built')

			if (event.errors.length > 0) {
				setErrors((currentErrors) => {
					let errs = typeof currentErrors === 'undefined' ? [] : currentErrors

					// Remove duplicates by using Set
					return [...new Set<string>([...errs, ...event.errors])]
				})
			}
		}

		const rebuilding = (): void => {
			setCurrentPhase('buildingApp')
		}

		appEmitter.on('done', done).on('rebuilding', rebuilding)
		return () => {
			appEmitter.off('done', done).off('rebuilding', rebuilding)
		}
	}, [])

	// apiEmitter
	useEffect(() => {
		const connectionChange = (event: ApiEvents['connectionChange']): void => {
			setApiConnections(event.connectionsCount)
		}

		apiEmitter.on('connectionChange', connectionChange)
		return () => {
			apiEmitter.off('connectionChange', connectionChange)
		}
	}, [])

	const debugLink = `http://localhost:3000/v2?hp=${encodeURIComponent(
		(httpServer.address() as AddressInfo).port
	)}&wp=${encodeURIComponent((wsServer.address() as AddressInfo).port)}`

	return (
		<Box flexWrap="wrap">
			<Box width="100%">
				{typeof errors !== 'undefined' && errors.length > 0 ? (
					<Text>
						<Text>{symbols.error} Error occurred</Text>
						<Newline />
						<Newline />
						<Text dimColor>
							{errors?.map((error, i) => (
								<Text key={i}>
									{error}
									<Newline />
								</Text>
							)) ?? null}
						</Text>
					</Text>
				) : (
					<Box width="100%">
						{currentPhase === 'built' ? (
							<Text>{symbols.success}</Text>
						) : (
							<Spinner type="dots" />
						)}
						<Text>{` ${phasesTranslations[currentPhase]}`}</Text>
					</Box>
				)}
			</Box>

			<Box width="100%" paddingTop={1}>
				<Text>
					{apiConnections === 0 ? symbols.info : symbols.success} Debug your app
					live here: <Text color={'blueBright'}>{debugLink}</Text>
				</Text>
			</Box>
			<Box paddingTop={1} width="100%">
				<Text dimColor>
					<Text>Press &quot;q&quot; to quit</Text>
					<Newline />
					<Text>Press &quot;enter&quot; to rebuild</Text>
				</Text>
			</Box>
		</Box>
	)
}
