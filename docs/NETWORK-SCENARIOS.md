# Network scenarios

MSW runs in development, preview, E2E and the published browser build. Confirmed mock match records are stored in `localStorage`; client-side pending submissions live in a separate persistent outbox.

The network-scenario selector is intentionally hidden from normal players. Open the app with `?dev=1` (or `?e2e=1` in automated tests), then use **Options → Network Scenario**.

Axios uses a 3500 ms timeout. Normal simulated latency is about 140 ms.

| Scenario | Ranking/history | Match registration | Purpose |
| --- | --- | --- | --- |
| `normal` | success | success | baseline |
| `empty` | empty lists | success | empty-state UI |
| `pagination` | paginated data | success | paging |
| `slow` | ~1400 ms | delayed success | loading states |
| `timeout` | ~4200 ms / Axios timeout | ~4200 ms / Axios timeout | generic timeout without server mutation |
| `variable-latency` | deterministic 120/760/260/1080 ms cycle | same | timing variation |
| `out-of-order` | alternating 1150/90 ms | same | stale-response protection |
| `network-error` | connection error | connection error | offline/network path |
| `client-error` | HTTP 422 | HTTP 422 | client HTTP error |
| `server-error` | HTTP 503 | HTTP 503 | server HTTP error |
| `ranking-error` | ranking GET 503 only | success | isolated ranking failure |
| `history-error` | history GET 503 only | success | isolated history failure |
| `timeout-after-save` | normal GETs | record is stored, then response waits ~5 s | idempotent retry after unknown outcome |
| `unavailable-on-game-over` | normal GETs | HTTP 503 | persistent outbox + later recovery |

## Query behavior

Ranking keys include session time, spawn interval, page and the selected network scenario. History keys include local player id, page and scenario. GET query functions pass TanStack Query's `AbortSignal` through Axios, and successful registration invalidates ranking/history.

Normal queries allow one TanStack Query retry; demo failure scenarios disable that automatic retry so each selected failure remains deterministic and visible.

## Recovery flow

1. A completed match receives a stable `matchId`.
2. The client writes the record to the outbox before POSTing.
3. The POST succeeds, fails or times out.
4. On success, only that `matchId` leaves the outbox.
5. On failure/timeout, the record remains pending and the player may start another match.
6. Pending records are retried on app bootstrap and when returning to the menu.
7. If the mock server already stored the record (for example `timeout-after-save`), retrying the same `matchId` returns the existing record instead of adding a duplicate.

## Reset behavior

**Restore calm seas** resets the network scenario to `normal`, clears the mock confirmed-record database and resets the mock request-sequence counter.

It intentionally does **not** clear the client outbox. Keeping the outbox allows the “backend unavailable → restore network → recover pending match” case to be demonstrated.
