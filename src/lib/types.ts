export type Apps = {
	[stackName: string]: { [appName: string]: SerializedComponent[] }
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
