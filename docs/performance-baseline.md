# Local Performance and Memory Baseline

Date: 16 July 2026  
Environment: macOS, Node.js 22.15.0, Next.js 16.2.10, Turbopack

## Production build memory

Captured with `npm run build:memory` after the authenticated-layout,
instrumentation, and lazy-loading changes:

| Measurement | Result |
|---|---:|
| Peak process heap | 29.60 MB |
| Peak reported RSS | 1,740.80 MB |
| Total garbage-collection time | 22.78 ms |
| Routes generated | 148 |
| Build result | Passed |

RSS includes native allocations and build workers, so it should not be compared
directly with JavaScript heap. This is a build baseline, not evidence that the
earlier long-running development-server growth is resolved.

## Bundle analysis

`npm run analyze` completed successfully. The local interactive report is
generated under `.next/diagnostics/analyze` and is intentionally excluded from
git because it is generated build output.

Targeted lazy loading now defers:

- `jszip` until a certificate archive is requested;
- `emoji-picker-react` until the competition wizard needs its picker.

## Runtime diagnostics

- `npm run dev:inspect` starts development with the Node inspector for manual
  heap snapshots.
- `ENABLE_RUNTIME_METRICS=true` enables structured memory measurements every
  60 seconds by default.
- `RUNTIME_METRICS_INTERVAL_MS` may adjust the interval, with a minimum of 15
  seconds.

## Remaining controlled test

The earlier development crash occurred after sustained work and cannot be
closed by a short build. Run separate idle, navigation, edit/recompile, and
backup/import sessions. Compare heap snapshots and RSS trends with a standalone
production run before changing Next.js memory flags or increasing the heap.
