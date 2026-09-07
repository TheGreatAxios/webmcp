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

## Release

```bash
bun run release 0.1.1 --otp <code>   # --dry-run to preview
```

The script checks a clean tree, runs build/test/typecheck, bumps all four
packages together, publishes core → bridge/react → umbrella (resumable:
rerun with a fresh OTP), restores `workspace:*` deps, then commits and
tags `vX.Y.Z`. Push with `git push origin2 main --follow-tags`.
