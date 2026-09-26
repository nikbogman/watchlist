# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the shared product glossary.
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per app. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `apps/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **multi-context**: a pnpm workspace with `apps/mobile` and `apps/server`.

```
/
├── CONTEXT-MAP.md                     ← points at each context's CONTEXT.md
├── CONTEXT.md                         ← shared product glossary (Movie, Status, Favourite…)
├── docs/adr/                          ← system-wide decisions
└── apps/
    ├── mobile/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← mobile-specific decisions
    └── server/
        ├── CONTEXT.md
        └── docs/adr/                  ← server-specific decisions
```

Terms shared by both apps belong in the root `CONTEXT.md`; app-specific terms go in that app's `CONTEXT.md`. ADRs follow the same split.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
