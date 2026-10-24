export interface HttpTransportOptions {
	host: string;
	apiKey: string;
	timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

export class HttpTransport {
	private readonly host: string;
	private readonly apiKey: string;
	private readonly timeoutMs: number;

	constructor(options: HttpTransportOptions) {
		this.host = options.host;
		this.apiKey = options.apiKey;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	async sendLogs(logs: LogPayload[]): Promise<void> {
		await this.request('POST', '/logs/batch', { logs });
	}

	async sendMetrics(metrics: MetricPayload[]): Promise<void> {
		// Send metrics one by one since the API expects single metric updates
		await Promise.all(
			metrics.map((metric) => this.request('PUT', '/metrics', metric)),
		);
	}

	async sendEvents(events: EventPayload[]): Promise<void> {
		// The API takes one event per request
		await Promise.all(
			events.map((event) => this.request('POST', '/events', event)),
		);
	}

	private async request(
		method: 'POST' | 'PUT',
		path: string,
		body: unknown,
	): Promise<void> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const response = await fetch(`${this.host}${path}`, {
				method,
				headers: {
					'Content-Type': 'application/json',
					'project-api-key': this.apiKey,
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${response.statusText}`,
				);
			}
		} finally {
			clearTimeout(timeoutId);
		}
	}
}

export interface LogPayload {
	message: string;
	level: string;
	createdAt: string;
	sequenceNumber: number;
	namespace?: string;
	app?: string;
}

export interface MetricPayload {
	name: string;
	value: number;
	operation: 'set' | 'change';
	namespace?: string;
	app?: string;
}

export interface EventPayload {
	id: string;
	name: string;
	props?: Record<string, string | number | boolean>;
	userId?: string | number;
	app?: string;
}
