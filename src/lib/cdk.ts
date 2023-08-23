import NodeEvaluator from 'cfn-resolver-lib'
import { fork } from 'child_process'
import { JSONPath } from 'jsonpath-plus'
import * as path from 'path'

import { CdkForkedInput, CdkForkedOutput, CdkForkedStacks } from './types.js'

export const buildCdkTree = (tmpDir: string): Promise<CdkForkedOutput> =>
	new Promise<CdkForkedOutput>((resolve, reject) => {
		const forked = fork(
			path.join(
				path.dirname(import.meta.url.replace('file://', '')),
				'./forked.js'
			),
			{
				silent: true,
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

		forked.on('message', (message) => {
			try {
				const template = JSON.parse(`${message}`) as CdkForkedOutput

				resolve(template)
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

export const extractAppsFromStacks = (
	stacks: CdkForkedStacks
): {
	[stackId: string]: { [appId: string]: any }
} => {
	return Object.entries(stacks).reduce<{
		[stackId: string]: { [appId: string]: any }
	}>((acc, [stackId, template]) => {
		acc[stackId] = {}

		const rawButtonizeResources = Object.entries<any>(template.Resources)
			.filter(([, { Type }]) => Type === 'Custom::ButtonizeApp')
			.map(([, resource]) => resource)

		const refs = JSONPath<string[]>({
			path: '$..Ref',
			json: rawButtonizeResources
		})
		const getAtts = JSONPath<[string, string][]>({
			path: '$..Fn::GetAtt',
			json: rawButtonizeResources
		})

		// The cfn-resolver-lib library is logging warnings
		// And we don't want any of those logs in our CLI
		const warn = console.warn
		console.warn = (): void => {}

		const resolvedTemplate = new NodeEvaluator(template, {
			RefResolvers: {
				...refs.reduce((acc, refName) => ({ ...acc, [refName]: 'value' }), {}),
				'AWS::Region': 'us-east-1',
				'AWS::Partition': 'aws',
				'AWS::AccountId': '000000000000',
				'AWS::StackId': 'MyEvaluatedFakeStackUsEast1'
			},
			'Fn::GetAttResolvers': getAtts.reduce(
				(acc, [logicalId, parameter]) => ({
					...acc,
					[logicalId]: {
						...(logicalId in acc ? acc[logicalId] : {}),
						[parameter]: 'somevalue'
					}
				}),
				{} as { [key: string]: { [key: string]: string } }
			)
		}).evaluateNodes()

		// Revert console.warn
		console.warn = warn

		const rawApps = Object.entries<any>(resolvedTemplate.Resources).filter(
			([, { Type }]) => Type === 'Custom::ButtonizeApp'
		)

		for (const [rawAppId, rawAppTemplate] of rawApps) {
			acc[stackId][rawAppId] = JSON.parse(rawAppTemplate.Properties.Props).app
		}

		return acc
	}, {})
}
