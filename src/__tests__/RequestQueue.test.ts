import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestQueue } from '../queue/RequestQueue.js';

describe('RequestQueue', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('add', () => {
		it('adds items to the queue', () => {
			const sendFn = vi.fn().mockResolvedValue(undefined);
			const queue = new RequestQueue(sendFn);

			queue.add({ id: 1 });
			queue.add({ id: 2 });

			queue.destroy();
			expect(sendFn).not.toHaveBeenCalled(); // Not flushed yet
		});

		it('ignores items after destroy', () => {
			const sendFn = vi.fn().mockResolvedValue(undefined);
			const queue = new RequestQueue(sendFn);

			queue.destroy();
			queue.add({ id: 1 });

			expect(sendFn).not.toHaveBeenCalled();
		});
	});

	describe('batching', () => {
		it('flushes when batch size is reached', async () => {
			const sendFn = vi.fn().mockResolvedValue(undefined);
			const queue = new RequestQueue(sendFn, { batchSize: 3 });

			queue.add({ id: 1 });
			queue.add({ id: 2 });
			expect(sendFn).not.toHaveBeenCalled();

			queue.add({ id: 3 }); // Triggers flush

			// Wait for the async operation
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(sendFn).toHaveBeenCalledWith([
				{ id: 1 },
				{ id: 2 },
				{ id: 3 },
			]);

			queue.destroy();
		});

		it('flushes on interval', async () => {
			const sendFn = vi.fn().mockResolvedValue(undefined);
			const queue = new RequestQueue(sendFn, {
				batchSize: 100,
				flushIntervalMs: 50,
			});

			queue.add({ id: 1 });
			queue.add({ id: 2 });

			// Wait for interval
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(sendFn).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);

			queue.destroy();
		});
	});

	describe('retry', () => {
		it('retries failed requests', async () => {
			const sendFn = vi
				.fn()
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce(undefined);

			const queue = new RequestQueue(sendFn, {
				batchSize: 1,
				maxRetries: 3,
				baseRetryDelayMs: 10,
			});

			queue.add({ id: 1 });

			// Wait for retries
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(sendFn).toHaveBeenCalledTimes(2);

			queue.destroy();
		});

		it('stops after max retries', async () => {
			const sendFn = vi
				.fn()
				.mockRejectedValue(new Error('Network error'));

			const queue = new RequestQueue(sendFn, {
				batchSize: 1,
				maxRetries: 3,
				baseRetryDelayMs: 10,
			});

			queue.add({ id: 1 });

			// Wait for all retries (10 + 20 + 40 = 70ms base, add buffer)
			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(sendFn).toHaveBeenCalledTimes(3);

			queue.destroy();
		});
	});

	describe('flush', () => {
		it('sends remaining items immediately', async () => {
			const sendFn = vi.fn().mockResolvedValue(undefined);
			const queue = new RequestQueue(sendFn, { batchSize: 100 });

			queue.add({ id: 1 });
			queue.add({ id: 2 });

			await queue.flush();

			expect(sendFn).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);

			queue.destroy();
		});

		it('waits for in-flight requests', async () => {
			let resolveRequest: () => void;
			const sendFn = vi.fn().mockImplementation(
				() =>
					new Promise<void>((resolve) => {
						resolveRequest = resolve;
					}),
			);

			const queue = new RequestQueue(sendFn, { batchSize: 1 });

			queue.add({ id: 1 });

			// Start flush but don't await yet
			const flushPromise = queue.flush();

			// Resolve the pending request
			await new Promise((resolve) => setTimeout(resolve, 10));
			resolveRequest!();

			await flushPromise;

			expect(sendFn).toHaveBeenCalled();

			queue.destroy();
		});
	});

	describe('destroy', () => {
		it('stops the flush timer', async () => {
			const sendFn = vi.fn().mockResolvedValue(undefined);
			const queue = new RequestQueue(sendFn, { flushIntervalMs: 50 });

			queue.add({ id: 1 });
			queue.destroy();

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(sendFn).not.toHaveBeenCalled();
		});
	});
});
