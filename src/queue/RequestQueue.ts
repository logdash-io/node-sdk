import { internalLogger } from '../logger/internalLogger.js';

export type SendFunction<T> = (items: T[]) => Promise<void>;

export interface RequestQueueOptions {
	batchSize?: number;
	flushIntervalMs?: number;
	maxRetries?: number;
	baseRetryDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<RequestQueueOptions> = {
	batchSize: 25,
	flushIntervalMs: 1000,
	maxRetries: 3,
	baseRetryDelayMs: 1000,
};

export class RequestQueue<T> {
	private queue: T[] = [];
	private inFlightPromises: Set<Promise<void>> = new Set();
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private destroyed = false;
	private readonly options: Required<RequestQueueOptions>;

	constructor(
		private readonly sendFn: SendFunction<T>,
		options?: RequestQueueOptions,
	) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.scheduleFlush();
	}

	add(item: T): void {
		if (this.destroyed) {
			return;
		}

		this.queue.push(item);

		if (this.queue.length >= this.options.batchSize) {
			this.flushBatch();
		}
	}

	async flush(): Promise<void> {
		// Flush any remaining items in the queue
		if (this.queue.length > 0) {
			this.flushBatch();
		}

		// Wait for all in-flight requests to complete
		await Promise.all(Array.from(this.inFlightPromises));
	}

	destroy(): void {
		this.destroyed = true;
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
	}

	private scheduleFlush(): void {
		if (this.destroyed) {
			return;
		}

		this.flushTimer = setTimeout(() => {
			if (this.queue.length > 0) {
				this.flushBatch();
			}
			this.scheduleFlush();
		}, this.options.flushIntervalMs);
	}

	private flushBatch(): void {
		if (this.queue.length === 0) {
			return;
		}

		const batch = this.queue.splice(0, this.options.batchSize);
		const promise = this.sendWithRetry(batch);

		this.inFlightPromises.add(promise);
		promise.finally(() => {
			this.inFlightPromises.delete(promise);
		});
	}

	private async sendWithRetry(items: T[]): Promise<void> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
			try {
				await this.sendFn(items);
				return;
			} catch (error) {
				lastError =
					error instanceof Error ? error : new Error(String(error));

				if (attempt < this.options.maxRetries - 1) {
					const delay =
						this.options.baseRetryDelayMs * Math.pow(2, attempt);
					await this.sleep(delay);
				}
			}
		}

		// All retries exhausted - log error but don't throw to avoid breaking the app
		internalLogger.error(
			`Failed to send batch after ${this.options.maxRetries} attempts:`,
			lastError?.message,
		);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
