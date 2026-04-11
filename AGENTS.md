# Project Agent Guide

## Build, Lint & Test
- **Build all assets**: `npm run build`
- **Compile JavaScript**: `npm run build:code` (Rollup + sourcemap)
- **Generate CSS**: `npm run build:css` (lessc)
- **Pack database files**: `npm run build:db` (Node script)
- **Clean pack cache**: `npm run build:clean`
- **Lint**: `npm run lint`
- **Auto‑fix lint issues**: `npm run lint:fix`
- **Watch LESS for hot reload**: `npm run watch`

- Tests are under `./tests` and run inside Foundry (not via npm).

## Code Style & Conventions
- **File format**: All source files are ES modules (`*.mjs`). They live at the repo root or under `module/`.
- **Imports**: Use relative paths only. Include file extensions (e.g., `./foo.mjs`). Avoid wildcard imports.
- **Formatting**: ESLint enforces style. Run `npm run lint:fix` to auto‑format.
- **JSDoc**: Every public function, class, or module needs a JSDoc block. Keep tags short: `@param`, `@returns`, `@throws`.
- **Naming**: Variables/functions: camelCase | Classes: PascalCase | Constants: UPPER_SNAKE_CASE | Files: kebab-case
- **Error handling**: Use `throw new Error(message)` for unrecoverable errors. Wrap async ops in `try/catch` and log with `fancyLog()`.
- **Logging**: Use `fancyLog()` from `@foundryvtt/foundryvtt-cli`. Do not use `console.log` in production.

## Project Structure
- **Entry point**: `dnd5e.mjs`
- **Compiled bundle**: `dnd5e-compiled.mjs` (untracked in git)
- **Assets**: Packs, tokens, and images under `packs/` or `tokens/`
- **Source**: `module/` directory contains core modules

## Misc
- **Copilot**: See `.github/copilot-instructions.md` for team conventions.
- **Testing**: If you add tests, keep them in a dedicated folder to avoid accidental commits of test data.

---

**Tip**: After any change, run `npm run lint && npm run build` to ensure code quality and a fresh bundle.