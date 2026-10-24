# @logdash/node

Logdash is how SaaS founders keep their apps healthy. This package serves a NodeJS/Bun/Deno interface to use it.

## Pre-requisites

Setup your free project in less than 2 minutes at [logdash.io](https://logdash.io/)

## Installation

```
npm install @logdash/node
```

## Logging

```typescript
import { Logdash } from '@logdash/node';

const logdash = new Logdash('<your-api-key>');

logdash.info('Application started successfully');
logdash.error('An unexpected error occurred');
logdash.warn('Low disk space warning');
```

## Namespaced Logging

```typescript
const authLogdash = logdash.withNamespace('auth');
authLogdash.info('User logged in');
authLogdash.error('Authentication failed');
```

## Apps

A domain has one domain key, shared by all of its apps, for example a desktop app, an API and a landing page.
Set `app` to name this app, so the dashboard can filter logs and metrics by app.
Logdash creates the app when its first log or metric arrives.

```typescript
const logdash = new Logdash('<your-domain-key>', { app: 'desktop' });

logdash.info('Window opened');

// Namespaced instances keep the app
const sidebarLogdash = logdash.withNamespace('sidebar');
sidebarLogdash.info('Sidebar collapsed');
```

Older service keys ignore `app`.

## Metrics

```typescript
import { Logdash } from '@logdash/node';

const logdash = new Logdash('<your-api-key>');

// to set absolute value
logdash.setMetric('users', 0);

// to modify existing metric
logdash.mutateMetric('users', 1);
```

## Events

```typescript
import { Logdash } from '@logdash/node';

const logdash = new Logdash('<your-api-key>');

logdash.track('agent_run', { model: 'opus', tools: 3 }, { userId: user.id });
```

Events show up in your domain's Analytics as goals, with a daily trend.
For signed-in users, pass their internal ID as `userId`, so one person counts once across your website and apps.
Without it, Logdash counts a visitor of that app that changes every day.
Never put personal data in props.

## Graceful Shutdown

```typescript
// Ensure all logs, metrics and events are sent before exiting
await logdash.flush();
```

## View

To see the logs or metrics, go to your project dashboard

![dashboard](docs/image.png)

## Configuration

```typescript
new Logdash(apiKey?, options?)
```

| Parameter         | Required | Default                  | Description                                                                                                              |
| ----------------- | -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `apiKey`          | no       | -                        | Api key used to authorize against logdash servers. If you don't provide one, logs will be logged into local console only |
| `options.host`    | no       | `https://api.logdash.io` | Custom API host, useful with self-hosted instances                                                                       |
| `options.verbose` | no       | `false`                  | Useful for debugging purposes                                                                                            |
| `options.app`     | no       | -                        | Name of the app that sends the logs and metrics, for example `desktop` or `api`. See [Apps](#apps)                       |

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues, please open an issue on GitHub or let us know at [contact@logdash.io](mailto:contact@logdash.io).
