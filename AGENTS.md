# ShagWekker Repository Agent Guide

## Project layout
- Frontend pages are static HTML/CSS/JS at repo root.
- API entrypoint is `api-server.js`.

## API framework direction
- Keep all new API endpoints versioned under `/api/v1`.
- Reuse the route registry and shared JSON response helpers in `api-server.js`.
- Preserve health endpoint semantics at `GET /api/v1/health` for uptime and readiness checks.

## Planned SQL integration
When SQL support is introduced:
1. Add a dedicated data-access layer (for example `api/db/`) instead of writing SQL in route handlers.
2. Add user + meter endpoints under `/api/v1/users` and `/api/v1/meter`.
3. Keep response payloads stable and additive for backward compatibility.
4. Store user records and shag meter totals (time + shaggie count) in normalized tables.

## Operational notes
- Configure host/port with `API_HOST` and `API_PORT`.
- Use `node api-server.js` to run the API locally.
