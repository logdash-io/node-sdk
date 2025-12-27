import chalk from 'chalk';
import { LogLevel, LOG_LEVEL_COLORS } from '../types/LogLevel.js';

const NAMESPACE = 'Logdash';

function formatMessage(level: LogLevel, args: unknown[]): void {
	const color = LOG_LEVEL_COLORS[level];

	const levelPrefix = chalk.rgb(
		color[0],
		color[1],
		color[2],
	)(`${level.toUpperCase()} `);
	const namespacePrefix = chalk.rgb(230, 0, 118)(`${NAMESPACE} `);
	const message = args
		.map((item) =>
			typeof item === 'object' && item !== null
				? JSON.stringify(item)
				: String(item),
		)
		.join(' ');

	console.log(`${namespacePrefix}${levelPrefix}${message}\n`);
}

export const internalLogger = {
	error: (...args: unknown[]) => formatMessage(LogLevel.ERROR, args),
	warn: (...args: unknown[]) => formatMessage(LogLevel.WARN, args),
	info: (...args: unknown[]) => formatMessage(LogLevel.INFO, args),
	verbose: (...args: unknown[]) => formatMessage(LogLevel.VERBOSE, args),
};
