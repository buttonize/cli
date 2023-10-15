import type { App as AppType, Stack as StackType } from 'aws-cdk-lib'
import type { Template as TemplateType } from 'aws-cdk-lib/assertions'
import * as path from 'path'

import { CdkForkedErrors, CdkForkedInput, CdkForkedStacks } from './types.js'

const sendResponse = ({
	stacks,
	errors
}: {
	stacks: CdkForkedStacks
	errors: CdkForkedErrors
}): void => {
	if (typeof process.send !== 'undefined') {
		process.send(JSON.stringify({ stacks, errors }))
	} else {
		throw new Error('This should never happen')
	}
}

console.log('forked.ts loaded')

export const forked = async ({ tmpDir }: CdkForkedInput): Promise<void> => {
	const stacks: CdkForkedStacks = {}
	const errors: string[] = []

	try {
		console.log(
			path.join(
				process.platform === 'win32' ? 'file://' : '',
				tmpDir,
				'node_modules',
				'aws-cdk-lib',
				'index.js'
			)
		)
		const { App, Stack } = await import(
			path.join(
				process.platform === 'win32' ? 'file://' : '',
				tmpDir,
				'node_modules',
				'aws-cdk-lib',
				'index.js'
			)
		)

		const { Template } = await import(
			path.join(
				process.platform === 'win32' ? 'file://' : '',
				tmpDir,
				'node_modules',
				'aws-cdk-lib',
				'assertions',
				'index.js'
			)
		)

		const binFile = await import(
			path.join(
				process.platform === 'win32' ? 'file://' : '',
				tmpDir,
				'bin',
				'cdk.js'
			)
		)

		for (const [, variableValue] of Object.entries(binFile)) {
			if (variableValue instanceof App) {
				try {
					const app = variableValue as AppType

					for (const child of app.node.children) {
						try {
							if (Stack.isStack(child)) {
								const stack = child as StackType

								stacks[stack.node.id] = {
									template: (
										Template.fromStack(app.node.children[0]) as TemplateType
									).toJSON(),
									metadata: {
										env: stack.environment,
										stackName: stack.stackName
									}
								}
							}
						} catch (err) {
							errors.push(`${err}`)
						}
					}
				} catch (err) {
					errors.push(`${err}`)
				}
			}
		}
	} catch (err) {
		errors.push(`${err}`)
	}

	sendResponse({
		stacks,
		errors: errors.map((err) =>
			// In order to make sure all error messages from CDK are relative to CWD and not tmpDir
			err.replaceAll(new RegExp(`(\/private)?${tmpDir}\/?`, 'g'), '')
		)
	})
}

process.on('message', (message) => {
	const data: CdkForkedInput = JSON.parse(message as string)
	forked(data)
})
