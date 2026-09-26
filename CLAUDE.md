# Watcher

pnpm workspace: `apps/mobile` (Expo, see [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md)) and `apps/server` (Hono + Drizzle + libSQL + Better Auth).

- Domain terms: [CONTEXT.md](CONTEXT.md). Specs: [docs/prd/](docs/prd/).
- Commit messages follow [COMMITS.md](COMMITS.md).
- Use agent-device only for app/device automation tasks. For a normal app-driving task, start immediately.
- Run `agent-device` through the workspace install (`pnpm exec agent-device`), not a global one.
