# @logdash/core

## 1.1.0

### Minor Changes

- 0ff4b8c: feat: add `track` that sends events, which show up as goals in the domain's Analytics
- 7c344ef: feat: add `app` option that names the app sending each log and metric

### Patch Changes

- 7c344ef: fix: retry only the metric that failed, so a failed request no longer re-applies `mutateMetric` changes that already went through
- 0ff4b8c: fix: let the process exit after `flush()`, since the background flush timer no longer keeps it alive

## 1.0.2

### Patch Changes

- 54ebf48: chore: noop

## 1.0.1

### Patch Changes

- fd7a94b: feat: minor changes

## 1.0.9

### Patch Changes

- 6d8dc70: feat: stringify json arguments

## 1.0.8

### Patch Changes

- a9ece96: chore: update readme with metrics

## 1.0.7

### Patch Changes

- 1f07662: chore: noop

## 1.0.6

### Patch Changes

- 43c9f2b: feat: batch improvements

## 1.0.5

### Patch Changes

- ce5af16: feat: add verbose metrics and host property

## 1.0.4

### Patch Changes

- 6fa859b: feat: adjust contracts

## 1.0.3

### Patch Changes

- 05215d9: fix: fix dto

## 1.0.2

### Patch Changes

- 16a8a5e: fix: add export

## 1.0.1

### Patch Changes

- 51b6213: feat: add metrics

## 1.0.0

### Major Changes

- c4fdbc3: fix: pretty logs, fix docs typos, etc

## 0.3.8

### Patch Changes

- 8e69ab7: feat: add info method

## 0.3.7

### Patch Changes

- 62f0ae6: feat: improve contract

## 0.3.6

### Patch Changes

- ce61576: fix date format

## 0.3.5

### Patch Changes

- 55d067f: export logger

## 0.3.4

### Patch Changes

- 887b6a1: add sequence numbers

## 0.3.3

### Patch Changes

- 2adb433: fix: warn->warning

## 0.3.2

### Patch Changes

- 6c1ec4f: chore: down chalk
- a583af0: chore: up lf

## 0.3.1

### Patch Changes

- d836249: chore: bump chalk

## 0.3.0

### Minor Changes

- f9873fa: fix: remove module type

## 0.2.0

### Minor Changes

- 76e2276: fix: chalk import bug

## 0.1.2

### Patch Changes

- 5e8f554: fix: imports

## 0.1.1

### Patch Changes

- 4078824: fix: lizma

## 0.1.0

### Minor Changes

- 5483389: feat: logger

## 0.0.2

### Patch Changes

- 4558f7e: chore: changesets
