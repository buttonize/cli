import { paginate } from '@baselime/paginate-aws'
import type { Account } from 'aws-cdk/lib/index.js'
import type { CloudFormation } from 'aws-sdk'
import NodeEvaluator, { NodeEvaluatorOptions } from 'cfn-resolver-lib'
import { EventEmitter } from 'events'

import { Emitter } from '../types.js'
import { CdkWatcherEmitter, CdkWatcherEvent } from './cdkWatcher.js'
import { getSdk } from './sdk.js'
import {
	Apps,
	CdkForkedErrors,
	CdkForkedStack,
	CdkForkedStacks
} from './types.js'

export type AppWatcherEvent =
	| { name: 'rebuilding' }
	| {
			name: 'done'
			apps: Apps
			errors: CdkForkedErrors
	  }

export type AppWatcherEmitter = Emitter<{ event: AppWatcherEvent }>

let deployedStackDataCache: {
	[key: string]: Awaited<ReturnType<typeof tryToFetchDeployedStack>>
} = {}

const resetDeployedStackDataCache = (): void => {
	deployedStackDataCache = {}
}

export const createAppWatcher = async ({
	cdkEmitter
}: {
	cdkEmitter: CdkWatcherEmitter
}): Promise<{
	appEmitter: AppWatcherEmitter
	rebuild: () => void
	close: () => void
}> => {
	const appEmitter = new EventEmitter() as AppWatcherEmitter

	let latestCdkEvent:
		| {
				name: 'done'
				stacks: CdkForkedStacks
				errors: CdkForkedErrors
		  }
		| undefined
	let buildInProgress = false

	const onCdkEvent = async (event: CdkWatcherEvent): Promise<void> => {
		switch (event.name) {
			case 'done':
				latestCdkEvent = event
				buildInProgress = true

				appEmitter.emit('event', {
					name: 'rebuilding'
				})

				const apps = await extractAppsFromStacks(event.stacks)

				appEmitter.emit('event', {
					name: 'done',
					apps,
					errors: event.errors
				})
				buildInProgress = false
		}
	}

	cdkEmitter.on('event', onCdkEvent)
	return {
		appEmitter,
		close(): void {
			cdkEmitter.off('event', onCdkEvent)
		},
		rebuild(): void {
			if (typeof latestCdkEvent !== 'undefined' && !buildInProgress) {
				resetDeployedStackDataCache()
				onCdkEvent(latestCdkEvent)
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
): Promise<Apps> => {
	const acc: Apps = {}

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
			const rawAppPages = Object.entries<any>(
				resolvedTemplate.Resources
			).filter(
				([, { Type, Properties }]) =>
					Type === 'Custom::ButtonizeAppPage' &&
					Properties.AppId[0] === rawAppId
			)

			acc[stackId][rawAppTemplate.Properties.AppIdName] = {
				docs: rawAppTemplate.Properties.Docs,
				executionRoleArn: undefined, // TODO
				executionRoleExternalId: undefined, // TODO
				label: rawAppTemplate.Properties.Label,
				pages: rawAppPages.reduce<Apps[string][string]['pages']>(
					(acc, [, rawPageTemplate]) => ({
						...acc,
						[rawPageTemplate.Properties.PageIdName]: {
							body: JSON.parse(rawPageTemplate.Properties.Body),
							label: rawPageTemplate.Properties.Label,
							docs: rawPageTemplate.Properties.Docs,
							isFirstPage: rawPageTemplate.Properties.IsFirstPage === 'true'
						}
					}),
					{}
				)
			}
		}
	}

	return acc
}
