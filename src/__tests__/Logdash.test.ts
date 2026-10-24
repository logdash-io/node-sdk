import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logdash } from '../Logdash.js';

describe('Logdash', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
		});
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	describe('constructor', () => {
		it('creates instance without options', () => {
			const logdash = new Logdash();
			expect(logdash).toBeInstanceOf(Logdash);
			logdash.destroy();
		});

		it('creates instance with apiKey', () => {
			const logdash = new Logdash('test-key');
			expect(logdash).toBeInstanceOf(Logdash);
			logdash.destroy();
		});

		it('creates instance with custom host', () => {
			const logdash = new Logdash('test-key', {
				host: 'https://custom.api.com',
			});
			expect(logdash).toBeInstanceOf(Logdash);
			logdash.destroy();
		});
	});

	describe('logging methods', () => {
		let logdash: Logdash;

		beforeEach(() => {
			logdash = new Logdash();
		});

		afterEach(() => {
			logdash.destroy();
		});

		it('logs error messages', () => {
			logdash.error('test error');
			expect(console.log).toHaveBeenCalled();
		});

		it('logs warn messages', () => {
			logdash.warn('test warning');
			expect(console.log).toHaveBeenCalled();
		});

		it('logs info messages', () => {
			logdash.info('test info');
			expect(console.log).toHaveBeenCalled();
		});

		it('logs http messages', () => {
			logdash.http('test http');
			expect(console.log).toHaveBeenCalled();
		});

		it('logs verbose messages', () => {
			logdash.verbose('test verbose');
			expect(console.log).toHaveBeenCalled();
		});

		it('logs debug messages', () => {
			logdash.debug('test debug');
			expect(console.log).toHaveBeenCalled();
		});

		it('logs silly messages', () => {
			logdash.silly('test silly');
			expect(console.log).toHaveBeenCalled();
		});

		it('formats objects as JSON', () => {
			logdash.info('data:', { key: 'value' });
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining('{"key":"value"}'),
			);
		});

		it('handles multiple arguments', () => {
			logdash.info('first', 'second', 123);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining('first second 123'),
			);
		});
	});

	describe('withNamespace', () => {
		let logdash: Logdash;

		beforeEach(() => {
			logdash = new Logdash();
		});

		afterEach(() => {
			logdash.destroy();
		});

		it('returns a new Logdash instance', () => {
			const namespaced = logdash.withNamespace('auth');
			expect(namespaced).toBeInstanceOf(Logdash);
		});

		it('includes namespace in log output', () => {
			const namespaced = logdash.withNamespace('auth');
			namespaced.info('test message');
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining('[auth]'),
			);
		});

		it('allows creating multiple namespaces', () => {
			const auth = logdash.withNamespace('auth');
			const db = logdash.withNamespace('db');

			auth.info('auth message');
			db.info('db message');

			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining('[auth]'),
			);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining('[db]'),
			);
		});
	});

	describe('metrics', () => {
		let logdash: Logdash;

		beforeEach(() => {
			logdash = new Logdash();
		});

		afterEach(() => {
			logdash.destroy();
		});

		it('queues setMetric calls', () => {
			// This shouldn't throw
			expect(() => logdash.setMetric('users', 100)).not.toThrow();
		});

		it('queues mutateMetric calls', () => {
			// This shouldn't throw
			expect(() => logdash.mutateMetric('requests', 1)).not.toThrow();
		});
	});

	describe('flush', () => {
		it('resolves when queue is empty', async () => {
			const logdash = new Logdash();
			await expect(logdash.flush()).resolves.toBeUndefined();
			logdash.destroy();
		});

		it('waits for pending items', async () => {
			const logdash = new Logdash();
			logdash.info('test message');
			await expect(logdash.flush()).resolves.toBeUndefined();
			logdash.destroy();
		});
	});

	describe('metric retries', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('re-sends only the metric that failed', async () => {
			vi.useFakeTimers();
			mockFetch.mockImplementation(async (_url, init) =>
				JSON.parse(init.body).name === 'failing'
					? { ok: false, status: 500, statusText: 'Server Error' }
					: { ok: true, status: 200, statusText: 'OK' },
			);
			const logdash = new Logdash('test-key');
			logdash.mutateMetric('requests', 1);
			logdash.mutateMetric('failing', 1);

			const flushed = logdash.flush();
			await vi.advanceTimersByTimeAsync(10_000);
			await flushed;
			logdash.destroy();

			const sent = mockFetch.mock.calls.map(
				([, init]) => JSON.parse(init.body).name,
			);
			expect(sent.filter((name) => name === 'requests')).toHaveLength(1);
			expect(sent.filter((name) => name === 'failing')).toHaveLength(3);
		});
	});

	describe('app', () => {
		// Sends a log and a metric from the root and from a namespaced
		// instance, and returns the request bodies they produced
		async function send(logdash: Logdash) {
			const auth = logdash.withNamespace('auth');
			logdash.info('root log');
			logdash.setMetric('users', 1);
			auth.info('auth log');
			auth.mutateMetric('logins', 1);
			await logdash.flush();
			logdash.destroy();

			const bodies = (path: string) =>
				mockFetch.mock.calls
					.filter(([url]) => url.endsWith(path))
					.map(([, init]) => JSON.parse(init.body));

			return {
				logs: bodies('/logs/batch').flatMap((body) => body.logs),
				metrics: bodies('/metrics'),
			};
		}

		it('adds app to every log and metric', async () => {
			const { logs, metrics } = await send(
				new Logdash('test-key', { app: 'desktop' }),
			);

			expect(logs).toEqual([
				expect.objectContaining({
					message: 'root log',
					app: 'desktop',
				}),
				expect.objectContaining({
					message: 'auth log',
					namespace: 'auth',
					app: 'desktop',
				}),
			]);
			expect(metrics).toEqual([
				{ name: 'users', value: 1, operation: 'set', app: 'desktop' },
				{
					name: 'logins',
					value: 1,
					operation: 'change',
					namespace: 'auth',
					app: 'desktop',
				},
			]);
		});

		it.each([undefined, ''])(
			'leaves app out of every log and metric when app is %j',
			async (app) => {
				const { logs, metrics } = await send(
					new Logdash('test-key', { app }),
				);

				expect(logs).toHaveLength(2);
				expect(metrics).toHaveLength(2);
				for (const payload of [...logs, ...metrics]) {
					expect(payload).not.toHaveProperty('app');
				}
			},
		);
	});
});
