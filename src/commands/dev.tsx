import { render } from 'ink'
import React from 'react'

import type { Program } from '../program.js'
import { Dev } from '../ui/dev.js'

export const dev = (program: Program) =>
	program.command(
		'dev',
		'Start a local development',
		(yargs) => yargs,
		async () => {
			const { linkNodeModulesToTmpDir, prepareTmpFolder } = await import(
				'../lib/utils.js'
			)

			const tmpDir = await prepareTmpFolder()
			await linkNodeModulesToTmpDir(tmpDir)

			render(<Dev tmpDir={tmpDir} />)
		}
	)
