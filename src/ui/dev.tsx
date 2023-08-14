import { Box, Newline, Text } from 'ink'
import Spinner from 'ink-spinner'
import React, { useEffect, useState } from 'react'
import type * as ts from 'typescript'

import { buildCdkTree } from '../lib/cdk.js'
import { CdkForkedOutput } from '../lib/types.js'
import { watcher } from '../lib/watcher.js'
import { formatTsErrorMessage } from './utils.js'

export const Dev: React.FC<{ tmpDir: string }> = ({ tmpDir }) => {
	const [status, setStatus] = useState<
		'init' | 'compilingTs' | 'buildingCdkTree' | 'built'
	>('init')

	const [output, setOutput] = useState<CdkForkedOutput | undefined>()

	const [tsError, setTsError] = useState<string | undefined>()

	useEffect(() => {
		const w = watcher({
			tmpDir,
			onBeforeCompilation() {
				setStatus('compilingTs')
				setTsError(undefined)
			},
			async onRecompiled() {
				setStatus('buildingCdkTree')

				const { stacks, errors } = await buildCdkTree(tmpDir)
				setOutput({ stacks, errors })

				setStatus('built')
			},
			onError: async (diagnostic: ts.Diagnostic) => {
				setTsError(await formatTsErrorMessage(tmpDir, diagnostic))
			}
		})

		return () => {
			w.then((wtch) => {
				wtch.close()
			})
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
					<Text inverse>
						{new Array(tsError.length + 2)
							.fill(1)
							.map(() => ' ')
							.join('')}
						<Newline /> {tsError} <Newline />
						{new Array(tsError.length + 2)
							.fill(1)
							.map(() => ' ')
							.join('')}
					</Text>
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
			return (
				<Box flexWrap="wrap">
					<Box borderStyle="single" paddingX={10}>
						<Text color="green" bold>
							CDK Built, yay!
						</Text>
					</Box>
					<Box borderStyle="single" width="100%">
						<Text>{JSON.stringify(output)}</Text>
					</Box>
				</Box>
			)
	}
}
