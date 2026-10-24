import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logdash } from '../Logdash.js';

describe('Logdash', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	// Returns the bodies of the requests sent to path
	const bodies = (path: string) =>
		mockFetch.mock.calls
			.filter(([url]) => url.endsWith(path))
			.map(([, init]) => JSON.parse(init.body));

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
		// Sends a log, a metric and an event from the root and from a
		// namespaced instance, and returns the request bodies they produced
		async function send(logdash: Logdash) {
			const auth = logdash.withNamespace('auth');
			logdash.info('root log');
			logdash.setMetric('users', 1);
			logdash.track('app_opened');
			auth.info('auth log');
			auth.mutateMetric('logins', 1);
			auth.track('signup_completed');
			await logdash.flush();
			logdash.destroy();

			return {
				logs: bodies('/logs/batch').flatMap((body) => body.logs),
				metrics: bodies('/metrics'),
				events: bodies('/events'),
			};
		}

		it('adds app to every log, metric and event', async () => {
			const { logs, metrics, events } = await send(
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
			expect(events).toEqual([
				{ id: expect.any(String), name: 'app_opened', app: 'desktop' },
				{
					id: expect.any(String),
					name: 'signup_completed',
					app: 'desktop',
				},
			]);
		});

		it.each([undefined, ''])(
			'leaves app out of every log, metric and event when app is %j',
			async (app) => {
				const { logs, metrics, events } = await send(
					new Logdash('test-key', { app }),
				);

				expect(logs).toHaveLength(2);
				expect(metrics).toHaveLength(2);
				expect(events).toHaveLength(2);
				for (const payload of [...logs, ...metrics, ...events]) {
					expect(payload).not.toHaveProperty('app');
				}
			},
		);
	});

	describe('track', () => {
		const UUID_V4 =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

		afterEach(() => {
			vi.useRealTimers();
		});

		it('posts each event with its props, userId and own UUID v4 id', async () => {
			const logdash = new Logdash('test-key');
			logdash.track(
				'agent_run',
				{ model: 'opus', tools: 3, cached: false },
				{ userId: 42 },
			);
			logdash.track('agent_run', undefined, { userId: 'user_7' });
			await logdash.flush();
			logdash.destroy();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.logdash.io/events',
				expect.objectContaining({ method: 'POST' }),
			);
			const [first, second] = bodies('/events');
			expect(first).toEqual({
				id: expect.stringMatching(UUID_V4),
				name: 'agent_run',
				props: { model: 'opus', tools: 3, cached: false },
				userId: 42,
			});
			expect(second).toEqual({
				id: expect.stringMatching(UUID_V4),
				name: 'agent_run',
				userId: 'user_7',
			});
			expect(second.id).not.toBe(first.id);
		});

		it.each(['Agent Run', '1st_run', 'pageview', undefined])(
			'drops an event named %j with a warning',
			async (name) => {
				const logdash = new Logdash('test-key');
				logdash.track(name);
				await logdash.flush();
				logdash.destroy();

				expect(bodies('/events')).toEqual([]);
				expect(console.log).toHaveBeenCalledWith(
					expect.stringContaining(`Event "${name}" was not sent`),
				);
			},
		);

		it('drops an event whose userId is an email address with a warning', async () => {
			const logdash = new Logdash('test-key');
			logdash.track('agent_run', undefined, {
				userId: 'alice@example.com',
			});
			await logdash.flush();
			logdash.destroy();

			expect(bodies('/events')).toEqual([]);
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining('userId must be an internal ID'),
			);
		});

		it('re-sends the same id when it retries', async () => {
			vi.useFakeTimers();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Server Error',
			});
			const logdash = new Logdash('test-key');
			logdash.track('agent_run');

			const flushed = logdash.flush();
			await vi.advanceTimersByTimeAsync(10_000);
			await flushed;
			logdash.destroy();

			const sent = bodies('/events');
			expect(sent).toHaveLength(2);
			expect(sent[1].id).toBe(sent[0].id);
		});

		it('flush waits for pending events', async () => {
			let respond: (response: object) => void;
			mockFetch.mockReturnValueOnce(
				new Promise((resolve) => {
					respond = resolve;
				}),
			);
			const logdash = new Logdash('test-key');
			logdash.track('agent_run');

			let flushed = false;
			const flushing = logdash.flush().then(() => {
				flushed = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(flushed).toBe(false);

			respond!({ ok: true, status: 202, statusText: 'Accepted' });
			await flushing;
			logdash.destroy();
			expect(flushed).toBe(true);
		});

		it('prints the event like a log and sends nothing without an API key', async () => {
			const logdash = new Logdash();
			logdash
				.withNamespace('agents')
				.track('agent_run', { model: 'opus' });
			await logdash.flush();
			logdash.destroy();

			expect(mockFetch).not.toHaveBeenCalled();
			expect(console.log).toHaveBeenLastCalledWith(
				expect.stringMatching(
					/EVENT .*\[agents\] .*agent_run \{"model":"opus"\}/,
				),
			);
		});
	});
});
