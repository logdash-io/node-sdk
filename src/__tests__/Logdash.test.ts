import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logdash } from '../LogDash.js';

describe('Logdash', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
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
});
