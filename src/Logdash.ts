import chalk from 'chalk';
import { internalLogger } from './logger/internalLogger.js';
import { RequestQueue } from './queue/RequestQueue.js';
import {
	HttpTransport,
	LogPayload,
	MetricPayload,
} from './transport/HttpTransport.js';
import { LogLevel, LOG_LEVEL_COLORS } from './types/LogLevel.js';

export interface LogdashOptions {
	host?: string;
	verbose?: boolean;
}

interface LogdashCore {
	logQueue: RequestQueue<LogPayload> | null;
	metricQueue: RequestQueue<MetricPayload> | null;
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
			const apiKey = apiKeyOrCore;
			const options = optionsOrNamespace as LogdashOptions | undefined;
			const verbose = options?.verbose ?? false;

			if (apiKey) {
				// Remote mode: create transport and queues
				const host = options?.host ?? 'https://api.logdash.io';
				const transport = new HttpTransport({ host, apiKey });

				this.core = {
					logQueue: new RequestQueue((logs) =>
						transport.sendLogs(logs),
					),
					metricQueue: new RequestQueue((metrics) =>
						transport.sendMetrics(metrics),
					),
					sequenceNumber: 0,
					verbose,
				};
			} else {
				internalLogger.warn('No API key provided, using local mode.');
				// Local mode: console-only, no transport or queues
				this.core = {
					logQueue: null,
					metricQueue: null,
					sequenceNumber: 0,
					verbose,
				};
			}
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
		if (!this.core.metricQueue) {
			return; // Local mode: metrics are not supported
		}

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
		if (!this.core.metricQueue) {
			return; // Local mode: metrics are not supported
		}

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
		if (!this.core.logQueue || !this.core.metricQueue) {
			return; // Local mode: nothing to flush
		}

		await Promise.all([
			this.core.logQueue.flush(),
			this.core.metricQueue.flush(),
		]);
	}

	destroy(): void {
		this.core.logQueue?.destroy();
		this.core.metricQueue?.destroy();
	}

	// === Private Methods ===

	private log(level: LogLevel, data: unknown[]): void {
		const message = this.formatData(data);
		const now = new Date();

		// Print to console with colors
		this.printToConsole(level, message, now);

		// Queue for sending (only in remote mode)
		this.core.logQueue?.add({
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
