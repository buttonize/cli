import { fork } from 'child_process'
import * as path from 'path'

import { CdkForkedInput, CdkForkedOutput } from './types.js'
import { isVerbose } from './utils.js'

export const buildCdkTree = (tmpDir: string): Promise<CdkForkedOutput> =>
	new Promise<CdkForkedOutput>((resolve, reject) => {
		const forked = fork(
			path.join(
				path.dirname(import.meta.url.replace('file://', '')),
				'./forked.js'
			),
			{
				silent: !isVerbose(),
				env: {
					...process.env,
					IS_BUTTONIZE_LOCAL: 'true',
					CDK_CONTEXT_JSON: JSON.stringify({
						// To prevent CDK from building the code assets
						// https://github.com/aws/aws-cdk/issues/18125#issuecomment-1359694521
						'aws:cdk:bundling-stacks': []
					})
				}
			}
		)

		forked.on('message', async (message) => {
			try {
				const response = JSON.parse(`${message}`) as CdkForkedOutput

				resolve(response)
			} catch (err) {
				reject(err)
			}
			forked.kill()
		})

		const message: CdkForkedInput = {
			tmpDir
		}

		forked.send(JSON.stringify(message))
	})