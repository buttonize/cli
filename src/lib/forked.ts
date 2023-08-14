import type { App as AppType } from 'aws-cdk-lib'
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

export const forked = async ({ tmpDir }: CdkForkedInput): Promise<void> => {
	const stacks: { [key: string]: object } = {}
	const errors: string[] = []

	try {
		const { App } = await import(
			path.join(tmpDir, 'node_modules', 'aws-cdk-lib', 'index.js')
		)

		const { Template } = await import(
			path.join(tmpDir, 'node_modules', 'aws-cdk-lib', 'assertions', 'index.js')
		)

		const binFile = await import(path.join(tmpDir, 'bin', 'cdk.js'))

		for (const [, variableValue] of Object.entries(binFile)) {
			if (variableValue instanceof App) {
				try {
					const app = variableValue as AppType
					for (const stack of app.node.children) {
						try {
							stacks[stack.node.id] = (
								Template.fromStack(app.node.children[0]) as TemplateType
							).toJSON()
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

	sendResponse({ stacks, errors })
}

process.on('message', (message) => {
	const data: CdkForkedInput = JSON.parse(message as string)
	forked(data)
})
