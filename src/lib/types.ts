export type Apps = {
	[stackId: string]: {
		[appId: string]: {
			label: string
			executionRoleArn?: string
			executionRoleExternalId?: string
			pages: {
				[pageId: string]: {
					label: string
					docs?: string
					body: SerializedComponent[]
				}
			}
			docs?: string
		}
	}
}

export type CdkForkedStack = {
	template: Apps
	metadata: {
		env: string
		stackName: string
	}
}

export type CdkForkedStacks = {
	[key: string]: CdkForkedStack
}

export type CdkForkedErrors = string[]

export type CdkForkedInput = {
	tmpDir: string
}

export type CdkForkedOutput = {
	stacks: CdkForkedStacks
	errors: CdkForkedErrors
}

export interface SerializedComponent {
	props?: any
	typeName: string
	children?: SerializedComponent[]
}
