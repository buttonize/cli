import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

export const program = yargs(hideBin(process.argv))
	.scriptName('btnz')
	.option('stage', {
		type: 'string',
		describe: 'The stage to use, defaults to personal stage'
	})
	.option('verbose', {
		type: 'boolean',
		describe: 'Print verbose logs'
	})
	.group(['stage', 'verbose', 'help'], 'Global:')
	.middleware(async (argv) => {
		if (argv.verbose) {
			process.env.BTNZ_VERBOSE = '1'
		}
		if (argv._.length > 0) {
			// const { trackCli } = await import("./telemetry/telemetry.js");
			// trackCli(argv._[0] as string);
		}
	})
	.version(false)
	.epilogue(`Join Buttonize community on Discord https://discord.gg/2quY4Vz5BM`)
	.recommendCommands()
	.demandCommand()
	.strict()
	.fail((_, error, yargs) => {
		if (!error) {
			yargs.showHelp()
			process.exit(1)
		}
		throw error
	})

export type Program = typeof program
