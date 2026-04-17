# Contributing to ide-bridge

Thanks for your interest! ide-bridge is an alpha project; expect rough edges.

## Development

```bash
git clone https://github.com/Xsidz/ide-bridge
cd ide-bridge
pnpm install
pnpm test         # 104 tests
pnpm typecheck
pnpm build
```

Node 20.10+ required. `pnpm` is the package manager (pinned via `packageManager` field).

## Pull requests

1. Fork and branch from `main`.
2. Make your change with a test. The project follows TDD — write a failing test first, then implement.
3. Run `pnpm test && pnpm typecheck && pnpm build` locally before pushing.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
5. Open a PR against `main`. CI will run the same checks.
6. Reviews focus on two things, in order: (a) does it match the spec/intent, (b) is the code clean?

## Testing

- Unit tests in `tests/unit/`
- Integration tests (HTTP + CLI + E2E) in `tests/integration/`
- Security tests in `tests/security/`
- Fixtures in `tests/fixtures/`
- Use `InMemoryStore` from `tests/helpers/` for tests that don't need real filesystem.

## Scope

v0.1 is intentionally small — local-only, single user, five IDEs. Before proposing a bigger feature, open an issue to discuss whether it belongs in v0.1.x, v0.2, or v1.0. See the roadmap in [README.md](README.md#roadmap).

## Security

See [SECURITY.md](SECURITY.md). Never open a public issue for security reports.

## License

By contributing you agree your contributions are licensed under the MIT license.
