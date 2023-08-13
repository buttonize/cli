/// <reference types="vitest" />

import { defineConfig } from 'vitest/config'

export default defineConfig(() => {
	return {
		test: {
			testTimeout: 30000,
			exclude: [
				'demo/cdk/**/*',
				'node_modules',
				'dist',
				'.idea',
				'.git',
				'.cache'
			]
			// coverage: {
			// 	cleanOnRerun: true,
			// 	enabled: true,
			// 	clean: true,
			// 	all: true,
			// 	src: ['src'],
			// 	exclude: ['**/*.test.ts', 'demo/cdk/**/*'],
			// 	extension: ['.ts'],
			// 	100: true
			// }
		}
	}
})
