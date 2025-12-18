import chalk from 'chalk';

const PREFIX = chalk.rgb(230, 0, 118)('[Logdash]');

export const internalLogger = {
	error: (...args: unknown[]) => {
		console.log(PREFIX, chalk.red('ERROR'), ...args);
	},
	warn: (...args: unknown[]) => {
		console.log(PREFIX, chalk.yellow('WARN'), ...args);
	},
	info: (...args: unknown[]) => {
		console.log(PREFIX, ...args);
	},
	verbose: (...args: unknown[]) => {
		console.log(PREFIX, chalk.gray(...args));
	},
};
