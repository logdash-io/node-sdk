// npx ts-node test.ts
import { Logdash } from './dist/index';

// Basic usage without API key (logs to console only, queues but won't send)
const logdash = new Logdash();

logdash.error('This is an error message');
logdash.warn('This is a warning message');
logdash.info('This is an info message');
logdash.http('This is an http message');
logdash.verbose('This is a verbose message');
logdash.debug('This is a debug message');
logdash.silly('This is a silly message');

// Usage with API key
const syncedLogdash = new Logdash('API_KEY', {
	host: 'https://dev-api.logdash.io',
});

syncedLogdash.error('This is a SYNCED error message');

// Namespaced logging
const authLogger = syncedLogdash.withNamespace('auth');
authLogger.info('User logged in');
authLogger.mutateMetric('login_count', 1);

const paymentsLogger = syncedLogdash.withNamespace('payments');
paymentsLogger.info('Payment processed');
paymentsLogger.warn('Payment gate not responding in 5s');
paymentsLogger.error('Payment failed');
paymentsLogger.mutateMetric('payment_count', 1);

// Metrics
syncedLogdash.setMetric('active_users', 42);
syncedLogdash.mutateMetric('requests', 1);

// Graceful shutdown - wait for all pending items
syncedLogdash.flush().then(() => {
	console.log('All logs and metrics flushed!');
	process.exit(0);
});
