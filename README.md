# Intelligent Order Processing System

AI-native order processing backend for the beecrowd/Winter senior fullstack assessment.
Stack: Next.js 15, Prisma, PostgreSQL, Redis, Vercel AI SDK, Docker Compose.

> Implementation in progress. See `specs/001-ai-order-engine/` for specification and plan.

## Development History

Commit history is an **evaluation criterion**. Changes are committed incrementally —
one logical slice at a time — not as a single bulk commit.

### Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) with task references:

```text
feat(orders): implement POST and GET /api/orders endpoints

Refs: T025-T026
```

| Type | Usage |
|------|-------|
| `feat` | New feature (user stories US1–US4) |
| `test` | Unit/integration tests |
| `chore` | Setup, Docker, dependencies |
| `docs` | README, SDD, GenAI report |
| `fix` | Bug fixes |
| `refactor` | Code changes without behavior change |

### Branch strategy

| Branch | Purpose |
|--------|---------|
| `master` | Planning artifacts (specs, constitution, tasks) |
| `001-ai-order-engine` | Implementation (T001–T052) |

One branch per feature; name matches `specs/<NNN-short-name>/`.

**Before `/speckit-implement`**: the agent MUST `git checkout 001-ai-order-engine`
(never implement on `master`). See `.cursor/rules/git-commits.mdc`.

### Commit rhythm

On the feature branch, commits align with checkpoints in
`specs/001-ai-order-engine/tasks.md`:

1. **Setup** — project scaffold, Docker, assets
2. **Foundational** — Prisma schema, Redis lock, shared services
3. **US1–US4** — tests → service → routes (one story at a time)
4. **Polish** — swagger, README SDD, GenAI report

Full agent guidance: `.cursor/rules/git-commits.mdc`

### Useful commands

```bash
git log --oneline --graph    # review incremental history
git log --grep="Refs: T"     # trace commits to tasks
```

## Documentation (planned)

- **SDD** — architecture, concurrency, Docker topology (T047)
- **GenAI report** — tools, prompts, failures, corrections (T048)
- **Quickstart** — `specs/001-ai-order-engine/quickstart.md`
