import { paginate } from '@baselime/paginate-aws'
import type { Account } from 'aws-cdk/lib/index.js'
import type { CloudFormation } from 'aws-sdk'
import NodeEvaluator, { NodeEvaluatorOptions } from 'cfn-resolver-lib'
import { EventEmitter } from 'events'

import { Emitter } from '../types.js'
import { CdkWatcherEvents } from './cdkWatcher.js'
import { getSdk } from './sdk.js'
import { CdkForkedErrors, CdkForkedStack, CdkForkedStacks } from './types.js'

export type AppWatcherEvents = {
	rebuilding: {}
	done: {
		apps: any
		errors: CdkForkedErrors
	}
}

let deployedStackDataCache: {
	[key: string]: Awaited<ReturnType<typeof tryToFetchDeployedStack>>
} = {}

const resetDeployedStackDataCache = (): void => {
	deployedStackDataCache = {}
}

export const createAppWatcher = async ({
	cdkEmitter
}: {
	cdkEmitter: Emitter<CdkWatcherEvents>
}): Promise<{
	appEmitter: Emitter<AppWatcherEvents>
	rebuild: () => void
	close: () => void
}> => {
	const appEmitter = new EventEmitter() as Emitter<AppWatcherEvents>

	let latestCdkEvent: CdkWatcherEvents['done'] | undefined
	let buildInProgress = false

	const done = async (event: CdkWatcherEvents['done']): Promise<void> => {
		latestCdkEvent = event
		buildInProgress = true

		appEmitter.emit('rebuilding', {})

		const apps = await extractAppsFromStacks(event.stacks)

		appEmitter.emit('done', {
			apps,
			errors: event.errors
		})
		buildInProgress = false
	}

	cdkEmitter.on('done', done)
	return {
		appEmitter,
		close(): void {
			cdkEmitter.off('done', done)
		},
		rebuild(): void {
			if (typeof latestCdkEvent !== 'undefined' && !buildInProgress) {
				resetDeployedStackDataCache()
				done(latestCdkEvent)
			}
		}
	}
}

export const tryToFetchDeployedStack = async (
	stack: CdkForkedStack
): Promise<{
	evaluatorOptions: NodeEvaluatorOptions
	region: string
	account: Account
}> => {
	const evaluatorOptions = {
		RefResolvers: {} as Exclude<
			NodeEvaluatorOptions['RefResolvers'],
			undefined
		>,
		'Fn::GetAttResolvers': {} as Exclude<
			NodeEvaluatorOptions['Fn::GetAttResolvers'],
			undefined
		>
	}

	const { sdk } = await getSdk(stack)

	const cfn = sdk.cloudFormation() as CloudFormation

	// For now only resolve Lambda Functions. Should be sufficient.
	for await (const stacks of paginate(
		(next) =>
			cfn
				.listStackResources({
					StackName: stack.metadata.stackName,
					NextToken: next
				})
				.promise(),
		'NextToken'
	)) {
		const onlyLambdas = stacks.StackResourceSummaries?.filter(
			({ ResourceType }) => ResourceType === 'AWS::Lambda::Function'
		)

		for (const { LogicalResourceId, PhysicalResourceId } of onlyLambdas ?? []) {
			const account = await sdk.currentAccount()

			evaluatorOptions.RefResolvers[LogicalResourceId] = `${PhysicalResourceId}`
			evaluatorOptions['Fn::GetAttResolvers'][LogicalResourceId] = {
				Arn: `arn:${account.partition}:lambda:${sdk.currentRegion}:${account.accountId}:function:${PhysicalResourceId}`
			}
		}
	}

	return {
		evaluatorOptions,
		region: sdk.currentRegion,
		account: await sdk.currentAccount()
	}
}

export const extractAppsFromStacks = async (
	stacks: CdkForkedStacks
): Promise<{
	[stackId: string]: { [appId: string]: any }
}> => {
	const acc: {
		[stackId: string]: { [appId: string]: any }
	} = {}

	for (const [stackId, stackData] of Object.entries(stacks)) {
		acc[stackId] = {}

		const key = `${stackData.metadata.stackName}__${stackData.metadata.env}`
		const deployedStackData =
			key in deployedStackDataCache
				? deployedStackDataCache[key]
				: await tryToFetchDeployedStack(stackData)
		deployedStackDataCache[key] = deployedStackData

		// The cfn-resolver-lib library is logging warnings
		// And we don't want any of those logs in our CLI
		const warn = console.warn
		console.warn = (): void => {}

		const resolvedTemplate = new NodeEvaluator(stackData.template, {
			RefResolvers: {
				...deployedStackData.evaluatorOptions.RefResolvers,
				'AWS::Region': deployedStackData.region,
				'AWS::Partition': deployedStackData.account.partition,
				'AWS::AccountId': deployedStackData.account.accountId
				// 'AWS::StackId': 'MyEvaluatedFakeStackUsEast1'
			},
			'Fn::GetAttResolvers':
				deployedStackData.evaluatorOptions['Fn::GetAttResolvers']
		}).evaluateNodes()

		// Revert console.warn
		console.warn = warn

		const rawApps = Object.entries<any>(resolvedTemplate.Resources).filter(
			([, { Type }]) => Type === 'Custom::ButtonizeApp'
		)

		for (const [rawAppId, rawAppTemplate] of rawApps) {
			acc[stackId][rawAppId] = JSON.parse(rawAppTemplate.Properties.Props).app
		}
	}

	return acc
}
