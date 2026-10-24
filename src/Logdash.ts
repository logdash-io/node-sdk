import { randomUUID } from 'node:crypto';
import chalk from 'chalk';
import { internalLogger } from './logger/internalLogger.js';
import { RequestQueue } from './queue/RequestQueue.js';
import {
	EventPayload,
	HttpTransport,
	LogPayload,
	MetricPayload,
} from './transport/HttpTransport.js';
import { LogLevel, LOG_LEVEL_COLORS } from './types/LogLevel.js';

const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/;
// The website tracker sends these, so the API rejects them from apps
const WEBSITE_EVENTS = ['pageview', 'pageleave', 'browser_error'];
const EVENT_COLOR: [number, number, number] = [152, 16, 250];

export interface LogdashOptions {
	host?: string;
	verbose?: boolean;
	app?: string;
}

interface LogdashCore {
	logQueue: RequestQueue<LogPayload> | null;
	metricQueue: RequestQueue<MetricPayload> | null;
	eventQueue: RequestQueue<EventPayload> | null;
	sequenceNumber: number;
	verbose: boolean;
	app?: string;
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
					// Each metric is its own request, so it is its own batch:
					// a retry must not re-apply metrics that already went through
					metricQueue: new RequestQueue(
						(metrics) => transport.sendMetrics(metrics),
						{ batchSize: 1 },
					),
					// Events too, so a retry re-sends only the event that failed
					eventQueue: new RequestQueue(
						(events) => transport.sendEvents(events),
						{ batchSize: 1 },
					),
					sequenceNumber: 0,
					verbose,
					// An empty app means no app: leave it out of payloads
					app: options?.app || undefined,
				};
			} else {
				internalLogger.warn('No API key provided, using local mode.');
				// Local mode: console-only, no transport or queues
				this.core = {
					logQueue: null,
					metricQueue: null,
					eventQueue: null,
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
			app: this.core.app,
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
			app: this.core.app,
		});
	}

	// === Event Methods ===

	track(
		name: string,
		props?: Record<string, string | number | boolean>,
		options?: { userId?: string | number },
	): void {
		// typeof first: RegExp.test turns undefined into 'undefined', a valid name
		if (
			typeof name !== 'string' ||
			!EVENT_NAME.test(name) ||
			WEBSITE_EVENTS.includes(name)
		) {
			internalLogger.warn(
				`Event "${name}" was not sent: its name must match ${EVENT_NAME} and not be one of ${WEBSITE_EVENTS.join(', ')}.`,
			);
			return;
		}

		const userId = options?.userId;
		if (typeof userId === 'string' && userId.includes('@')) {
			internalLogger.warn(
				`Event "${name}" was not sent: userId must be an internal ID, never an email address.`,
			);
			return;
		}

		if (!this.core.eventQueue) {
			// Local mode: print the event like a log, send nothing
			this.printToConsole(
				'EVENT',
				EVENT_COLOR,
				this.formatData(props ? [name, props] : [name]),
				new Date(),
			);
			return;
		}

		if (this.core.verbose) {
			internalLogger.verbose(`Tracking event ${name}`);
		}

		this.core.eventQueue.add({
			// Retries re-send this same id, so the API stores the event once
			id: randomUUID(),
			name,
			props,
			userId,
			app: this.core.app,
		});
	}

	// === Namespace ===

	withNamespace(name: string): Logdash {
		return new Logdash(this.core, name);
	}

	// === Lifecycle ===

	async flush(): Promise<void> {
		await Promise.all([
			this.core.logQueue?.flush(),
			this.core.metricQueue?.flush(),
			this.core.eventQueue?.flush(),
		]);
	}

	destroy(): void {
		this.core.logQueue?.destroy();
		this.core.metricQueue?.destroy();
		this.core.eventQueue?.destroy();
	}

	// === Private Methods ===

	private log(level: LogLevel, data: unknown[]): void {
		const message = this.formatData(data);
		const now = new Date();

		// Print to console with colors
		this.printToConsole(
			level.toUpperCase(),
			LOG_LEVEL_COLORS[level],
			message,
			now,
		);

		// Queue for sending (only in remote mode)
		this.core.logQueue?.add({
			message,
			level,
			createdAt: now.toISOString(),
			sequenceNumber: this.core.sequenceNumber++,
			namespace: this.namespace,
			app: this.core.app,
		});
	}

	private printToConsole(
		label: string,
		color: [number, number, number],
		message: string,
		date: Date,
	): void {
		const datePrefix = chalk.rgb(156, 156, 156)(`[${date.toISOString()}]`);
		const labelPrefix = chalk.rgb(
			color[0],
			color[1],
			color[2],
		)(`${label} `);
		const namespacePrefix = this.namespace
			? chalk.rgb(180, 180, 180)(`[${this.namespace}] `)
			: '';

		const formattedMessage = `${datePrefix} ${labelPrefix}${namespacePrefix}${message}`;
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
