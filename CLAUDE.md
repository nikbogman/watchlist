# Watcher

pnpm workspace: `apps/mobile` (Expo, see [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md)), `apps/server` (Hono + Drizzle + libSQL + Better Auth) and `packages/reel-scraper` (Playwright Instagram reel scraper, a prototype of a future server module).

- Domain terms: [CONTEXT.md](CONTEXT.md). Specs: GitHub issues, one per feature (Movie lists is #1).
- Commit messages follow [COMMITS.md](COMMITS.md).
- Use agent-device only for app/device automation tasks. For a normal app-driving task, start immediately.
- Run `agent-device` through the workspace install (`pnpm exec agent-device`), not a global one.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`nikbogman/watchlist`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: root `CONTEXT.md` (shared glossary) + `CONTEXT-MAP.md` pointing at `apps/mobile` and `apps/server` contexts. See `docs/agents/domain.md`.
