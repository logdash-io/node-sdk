---
'@logdash/node': patch
---

fix: retry only the metric that failed, so a failed request no longer re-applies `mutateMetric` changes that already went through
