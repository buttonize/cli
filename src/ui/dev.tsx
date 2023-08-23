import { Box, Text, useApp, useInput } from 'ink'
import Spinner from 'ink-spinner'
import React, { useEffect, useState } from 'react'

import { extractAppsFromStacks } from '../lib/cdk.js'
import { CdkForkedErrors } from '../lib/types.js'
import { WatcherEvents } from '../lib/watcher.js'
import { Emitter } from '../types.js'
import { InverseBoxText } from './InverseBoxText.js'
import { formatTsErrorMessage } from './utils.js'

type DevProps = {
	tmpDir: string
	watcher: Emitter<WatcherEvents>
}

export const Dev: React.FC<DevProps> = ({ tmpDir, watcher }) => {
	const [status, setStatus] = useState<
		'init' | 'compilingTs' | 'buildingCdkTree' | 'built'
	>('init')

	const [output, setOutput] = useState<
		{ apps: any; errors: CdkForkedErrors } | undefined
	>()

	const [tsError, setTsError] = useState<string | undefined>()

	const [generalError, setGeneralError] = useState<string | undefined>()

	const { exit } = useApp()

	useInput((input, key) => {
		if (key.escape || input === 'q') {
			exit()
		}
	})

	useEffect(() => {
		const beforeRecompilation = (): void => {
			setStatus('compilingTs')
			setTsError(undefined)
		}
		const recompiled = (): void => setStatus('buildingCdkTree')
		const builtCdkStacks = (event: WatcherEvents['builtCdkStacks']): void => {
			setStatus('built')

			setOutput({
				apps: extractAppsFromStacks(event.stacks),
				errors: event.errors
			})
		}
		const tsError = async (event: WatcherEvents['tsError']): Promise<void> =>
			setTsError(await formatTsErrorMessage(tmpDir, event.diagnostic))
		const tsConfigError = (): void =>
			setGeneralError('tsconfig.json not found.')

		watcher
			.on('beforeRecompilation', beforeRecompilation)
			.on('recompiled', recompiled)
			.on('builtCdkStacks', builtCdkStacks)
			.on('tsError', tsError)
			.on('tsConfigError', tsConfigError)

		return () => {
			watcher
				.off('beforeRecompilation', beforeRecompilation)
				.off('recompiled', recompiled)
				.off('builtCdkStacks', builtCdkStacks)
				.off('tsError', tsError)
				.off('tsConfigError', tsConfigError)
		}
	}, [])

	if (typeof tsError !== 'undefined') {
		return (
			<Box flexWrap="wrap">
				<Box borderStyle="single" paddingX={10}>
					<Text color="red" bold>
						TypeScript compilation error:
					</Text>
				</Box>
				<Box width="100%">
					<InverseBoxText>{tsError}</InverseBoxText>
				</Box>
			</Box>
		)
	}

	if (typeof generalError !== 'undefined') {
		return (
			<Box flexWrap="wrap">
				<Box borderStyle="single" paddingX={10}>
					<Text color="red" bold>
						Error:
					</Text>
				</Box>
				<Box width="100%">
					<InverseBoxText>{`${generalError}: ${generalError}`}</InverseBoxText>
				</Box>
			</Box>
		)
	}

	switch (status) {
		case 'init':
			return (
				<Box>
					<Spinner type="dots" />
					<Text> Initializing Buttonize CLI...</Text>
				</Box>
			)
		case 'compilingTs':
			return (
				<Box>
					<Spinner type="dots" />
					<Text> Building your CDK code...</Text>
				</Box>
			)
		case 'buildingCdkTree':
			return (
				<Box>
					<Spinner type="dots" />
					<Text> Extracting Buttonize constructs CDK...</Text>
				</Box>
			)
		case 'built':
			if (typeof output !== 'undefined' && output?.errors.length > 0) {
				return (
					<Box flexWrap="wrap">
						<Box borderStyle="single" paddingX={10}>
							<Text color="red" bold>
								CDK Build error:
							</Text>
						</Box>
						{output.errors.map((err, i) => (
							<Box width="100%" key={i} paddingBottom={1}>
								<InverseBoxText>{err}</InverseBoxText>
							</Box>
						))}
					</Box>
				)
			}
			return (
				<Box flexWrap="wrap">
					<Box borderStyle="single" paddingX={10}>
						<Text color="green" bold>
							CDK Built, yay!
						</Text>
					</Box>
					<Box borderStyle="single" width="100%">
						<Text>
							To start live development go to:{' '}
							<Text color={'blueBright'}>http://localhost:3000/v2</Text>
						</Text>
					</Box>
				</Box>
			)
	}
}
