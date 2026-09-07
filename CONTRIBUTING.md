# Contributing

```bash
bun install
bun run build
bun run test
bun run typecheck
```

CI runs the same four commands plus `bun run build:examples`. All must pass.

## Conventions

- Non-spec features use an `experimental_` prefix (see README). Breaking
  changes there don't require a major stable bump.
- Keep the diff minimal — reuse existing helpers before adding new ones.
- Non-trivial logic needs a test; trivial one-liners don't.
- All packages version in lockstep; note user-facing changes in `CHANGELOG.md`.
