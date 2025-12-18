import chalk from 'chalk';
import { internalLogger } from './logger/internalLogger.js';
import { RequestQueue } from './queue/RequestQueue.js';
import {
	HttpTransport,
	LogPayload,
	MetricPayload,
} from './transport/HttpTransport.js';
import { LogLevel } from './types/LogLevel.js';

export interface LogdashOptions {
	host?: string;
	verbose?: boolean;
}

const LOG_LEVEL_COLORS: Record<LogLevel, [number, number, number]> = {
	[LogLevel.ERROR]: [231, 0, 11],
	[LogLevel.WARN]: [254, 154, 0],
	[LogLevel.INFO]: [21, 93, 252],
	[LogLevel.HTTP]: [0, 166, 166],
	[LogLevel.VERBOSE]: [0, 166, 0],
	[LogLevel.DEBUG]: [0, 166, 62],
	[LogLevel.SILLY]: [80, 80, 80],
};

interface LogdashCore {
	logQueue: RequestQueue<LogPayload>;
	metricQueue: RequestQueue<MetricPayload>;
	sequenceNumber: number;
	verbose: boolean;
}

export class Logdash {
	private readonly core: LogdashCore;
	private readonly namespace?: string;

	constructor(apiKey?: string, options?: LogdashOptions);
	constructor(core: LogdashCore, namespace: string);
	constructor(
		apiKeyOrCore?: string | LogdashCore,
		optionsOrNamespace?: LogdashOptions | string,
	) {
		if (this.isLogdashCore(apiKeyOrCore)) {
			// Internal constructor for namespaced instances
			this.core = apiKeyOrCore;
			this.namespace = optionsOrNamespace as string;
		} else {
			// Public constructor: new Logdash(apiKey?, options?)
			const apiKey = apiKeyOrCore ?? '';
			const options = optionsOrNamespace as LogdashOptions | undefined;
			const host = options?.host ?? 'https://api.logdash.io';
			const verbose = options?.verbose ?? false;

			const transport = new HttpTransport({ host, apiKey });

			this.core = {
				logQueue: new RequestQueue((logs) => transport.sendLogs(logs)),
				metricQueue: new RequestQueue((metrics) =>
					transport.sendMetrics(metrics),
				),
				sequenceNumber: 0,
				verbose,
			};
			this.namespace = undefined;
		}
	}

	private isLogdashCore(value: unknown): value is LogdashCore {
		return (
			typeof value === 'object' &&
			value !== null &&
			'logQueue' in value &&
			'metricQueue' in value
		);
	}

	// === Logging Methods ===

	error(...data: unknown[]): void {
		this.log(LogLevel.ERROR, data);
	}

	warn(...data: unknown[]): void {
		this.log(LogLevel.WARN, data);
	}

	info(...data: unknown[]): void {
		this.log(LogLevel.INFO, data);
	}

	http(...data: unknown[]): void {
		this.log(LogLevel.HTTP, data);
	}

	verbose(...data: unknown[]): void {
		this.log(LogLevel.VERBOSE, data);
	}

	debug(...data: unknown[]): void {
		this.log(LogLevel.DEBUG, data);
	}

	silly(...data: unknown[]): void {
		this.log(LogLevel.SILLY, data);
	}

	// === Metric Methods ===

	setMetric(name: string, value: number): void {
		if (this.core.verbose) {
			internalLogger.verbose(`Setting metric ${name} to ${value}`);
		}

		this.core.metricQueue.add({
			name,
			value,
			operation: 'set',
			namespace: this.namespace,
		});
	}

	mutateMetric(name: string, delta: number): void {
		if (this.core.verbose) {
			internalLogger.verbose(`Mutating metric ${name} by ${delta}`);
		}

		this.core.metricQueue.add({
			name,
			value: delta,
			operation: 'change',
			namespace: this.namespace,
		});
	}

	// === Namespace ===

	withNamespace(name: string): Logdash {
		return new Logdash(this.core, name);
	}

	// === Lifecycle ===

	async flush(): Promise<void> {
		await Promise.all([
			this.core.logQueue.flush(),
			this.core.metricQueue.flush(),
		]);
	}

	destroy(): void {
		this.core.logQueue.destroy();
		this.core.metricQueue.destroy();
	}

	// === Private Methods ===

	private log(level: LogLevel, data: unknown[]): void {
		const message = this.formatData(data);
		const now = new Date();

		// Print to console with colors
		this.printToConsole(level, message, now);

		// Queue for sending
		this.core.logQueue.add({
			message,
			level,
			createdAt: now.toISOString(),
			sequenceNumber: this.core.sequenceNumber++,
			namespace: this.namespace,
		});
	}

	private printToConsole(level: LogLevel, message: string, date: Date): void {
		const color = LOG_LEVEL_COLORS[level];

		const datePrefix = chalk.rgb(156, 156, 156)(`[${date.toISOString()}]`);
		const levelPrefix = chalk.rgb(
			color[0],
			color[1],
			color[2],
		)(`${level.toUpperCase()} `);
		const namespacePrefix = this.namespace
			? chalk.rgb(180, 180, 180)(`[${this.namespace}] `)
			: '';

		const formattedMessage = `${datePrefix} ${levelPrefix}${namespacePrefix}${message}`;
		console.log(formattedMessage);
	}

	private formatData(data: unknown[]): string {
		return data
			.map((item) => {
				if (typeof item === 'object' && item !== null) {
					try {
						return JSON.stringify(item);
					} catch {
						return String(item);
					}
				}
				return String(item);
			})
			.join(' ');
	}
}
