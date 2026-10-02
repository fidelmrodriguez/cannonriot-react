# Network scenarios

MSW runs in the published browser build and stores confirmed match records in localStorage. The scenario selector is a reviewer/developer control and is hidden from the normal player-facing UI. Launch with `?dev=1` to expose it in Options; Playwright uses `?e2e=1`.

| Scenario | Ranking/history | Register match | Purpose |
| --- | --- | --- | --- |
| Calm seas | success | success | baseline |
| Empty lists | empty | success | empty-state UI |
| Multiple pages | paginated data | success | pagination |
| Slow network | 1400 ms | delayed success | loading states |
| Request timeout | exceeds Axios 3500 ms timeout | exceeds timeout | generic timeout path |
| Variable latency | deterministic 120/760/260/1080 ms cycle | same | timing variance |
| Out-of-order | alternating 1150/90 ms | same | stale-response protection |
| Connection failure | network error | network error | offline path |
| HTTP 422 | 422 | 422 | client HTTP failure |
| HTTP 503 | 503 | 503 | server failure |
| Ranking failure | 503 ranking only | success | isolated ranking failure |
| History failure | 503 history only | success | isolated history failure |
| Timeout after save | normal GET | record is stored, response exceeds Axios timeout | idempotent retry |
| Backend unavailable on game over | normal GET | 503 | persistent outbox + later recovery |

## Recovery flow

1. Match completes.
2. Client writes it to the outbox before POST.
3. POST fails/times out.
4. Player can immediately start another match.
5. Reviewer restores **Calm seas**.
6. Returning to the menu triggers another outbox recovery pass.
7. If the server had already stored the record, the same `matchId` returns the existing record.

## Reset

**Restore calm seas** clears the mock database and returns the scenario to normal. The client outbox is not cleared because doing so would destroy the recovery case being demonstrated.
