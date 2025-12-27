export enum LogLevel {
	ERROR = 'error',
	WARN = 'warning',
	INFO = 'info',
	HTTP = 'http',
	VERBOSE = 'verbose',
	DEBUG = 'debug',
	SILLY = 'silly',
}

export const LOG_LEVEL_COLORS: Record<LogLevel, [number, number, number]> = {
	[LogLevel.ERROR]: [231, 0, 11],
	[LogLevel.WARN]: [254, 154, 0],
	[LogLevel.INFO]: [21, 93, 252],
	[LogLevel.HTTP]: [0, 166, 166],
	[LogLevel.VERBOSE]: [0, 166, 0],
	[LogLevel.DEBUG]: [0, 166, 62],
	[LogLevel.SILLY]: [80, 80, 80],
};
