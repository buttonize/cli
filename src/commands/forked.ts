import * as path from 'path'

export const forked = async ({ tmpDir }: { tmpDir: string }) => {
	const { App } = await import(
		path.join(tmpDir, 'node_modules', 'aws-cdk-lib', 'index.js')
	)
	const { Template } = await import(
		path.join(tmpDir, 'node_modules', 'aws-cdk-lib', 'assertions', 'index.js')
	)

	const inputFile = await import(path.join(tmpDir, 'bin', 'cdk.js'))
	for (const [, variableValue] of Object.entries(inputFile)) {
		if (variableValue instanceof App) {
			const temp = Template.fromStack(variableValue.node.children[0])

			// @ts-expect-error send
			process.send(JSON.stringify(temp.toJSON()))
		}
	}
}

process.on('message', (message) => {
	const data = JSON.parse(message as string)
	forked({ tmpDir: data.tmpDir })
})
