---
'@logdash/node': patch
---

fix: let the process exit after `flush()`, since the background flush timer no longer keeps it alive
