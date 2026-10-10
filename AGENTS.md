# Qwida app

Hackathon app for the Caribbean AI Summit (submissions close Sat Oct 10, 12:00 AST). Master plan
and UI rules live in the private war room repo (`qwida-warroom/plan/MASTER-PLAN.md`,
`qwida-warroom/ui/AGENTS.md`); this repo is public at submission time.

## Rules

- Synthetic data only. Nothing from war room transcripts, no real health information, no keys.
- Fence copy is fixed in `lib/fence/copy.ts`. Never generate or paraphrase it.
- Nothing becomes `CONFIRMADO` without a human tap. AI output lands as `BORRADOR`.
- No em dashes or hyphens joining clauses in prose or UI copy.
- One owner per path: W1 `lib/store`, `lib/seed`, `lib/fence`, `app/api/{events,reset,visit}`,
  `components/ui`, `components/capture`; W2 `app/api/photo`, `lib/extract`; W3 `app/familia`;
  W4 `app/paciente`, `components/patient`.
- Verify with `npm run build`, `npm run lint`, `npm test`. Workers never push.
- Shared state: server code calls `getStore()` from `@/lib/store`; client code polls with
  `useEvents()` from `@/lib/client/useEvents`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
