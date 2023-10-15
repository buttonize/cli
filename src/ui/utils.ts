import path from 'path'
import type * as ts from 'typescript'

export const formatTsErrorMessage = async (
	tmpDir: string,
	diagnostic: ts.Diagnostic
): Promise<string> => {
	const importedTs = (
		await import(
			path.join(
				process.platform === 'win32' ? 'file://' : '',
				tmpDir,
				'node_modules',
				'typescript',
				'lib',
				'typescript.js'
			)
		)
	).default as typeof ts

	const formatHost: ts.FormatDiagnosticsHost = {
		getCanonicalFileName: (path) => path,
		getCurrentDirectory: () => tmpDir,
		getNewLine: () => ''
	}

	return importedTs.formatDiagnostic(diagnostic, formatHost)
}
