import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpTransport } from '../transport/HttpTransport.js';

describe('HttpTransport', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
		});
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('constructor', () => {
		it('creates instance with required options', () => {
			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});
			expect(transport).toBeInstanceOf(HttpTransport);
		});
	});

	describe('sendLogs', () => {
		it('sends logs to /logs/batch endpoint', async () => {
			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});

			await transport.sendLogs([
				{
					message: 'test',
					level: 'info',
					createdAt: '2024-01-01T00:00:00.000Z',
					sequenceNumber: 0,
				},
			]);

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.test.com/logs/batch',
				expect.objectContaining({
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'project-api-key': 'test-key',
					},
				}),
			);
		});

		it('wraps logs in batch format', async () => {
			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});

			await transport.sendLogs([
				{
					message: 'test message',
					level: 'error',
					createdAt: '2024-01-01T00:00:00.000Z',
					sequenceNumber: 42,
					namespace: 'auth',
				},
			]);

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const call = mockFetch.mock.calls[0];
			const body = JSON.parse(call[1].body);

			expect(body).toEqual({
				logs: [
					{
						message: 'test message',
						level: 'error',
						createdAt: '2024-01-01T00:00:00.000Z',
						sequenceNumber: 42,
						namespace: 'auth',
					},
				],
			});
		});
	});

	describe('sendMetrics', () => {
		it('sends metrics to /metrics endpoint', async () => {
			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});

			await transport.sendMetrics([
				{
					name: 'users',
					value: 100,
					operation: 'set',
				},
			]);

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.test.com/metrics',
				expect.objectContaining({
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'project-api-key': 'test-key',
					},
				}),
			);
		});

		it('sends each metric individually', async () => {
			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});

			await transport.sendMetrics([
				{ name: 'users', value: 100, operation: 'set' },
				{ name: 'requests', value: 1, operation: 'change' },
			]);

			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});

	describe('error handling', () => {
		it('throws on non-ok response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});

			await expect(
				transport.sendLogs([
					{
						message: 'test',
						level: 'info',
						createdAt: '2024-01-01T00:00:00.000Z',
						sequenceNumber: 0,
					},
				]),
			).rejects.toThrow('HTTP 500: Internal Server Error');
		});

		it('throws on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const transport = new HttpTransport({
				host: 'https://api.test.com',
				apiKey: 'test-key',
			});

			await expect(
				transport.sendLogs([
					{
						message: 'test',
						level: 'info',
						createdAt: '2024-01-01T00:00:00.000Z',
						sequenceNumber: 0,
					},
				]),
			).rejects.toThrow('Network error');
		});
	});
});
