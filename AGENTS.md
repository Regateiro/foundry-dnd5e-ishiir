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

- Tests are places under `./tests` and assume they run inside the Foundry environment.
>   * Tests depend on the Foundry runtime, meaning that they need to be executed inside the Foundry application.

## Code Style & Conventions
- **File format**: All source files are ES modules (`*.mjs`). They live either at the repo root or under `module/`.
- **Imports**:
>   * Use relative paths only.
>   * Include file extensions (e.g., `./foo.mjs`).
>   * Avoid wildcard imports; import only what you need.
- **Formatting**: ESLint enforces style. Run `npm run lint:fix` to auto‑format.
- **JSDoc**:
>   * Every public function, class, or module should start with a JSDoc block.
>   * Keep tags short: `@param`, `@returns`, `@throws`.
>   * Example:
>     ```js
>     /**
>      * Calculates the damage of a roll.
>      * @param {string} formula - Roll expression.
>      * @returns {number}
>      */
>     export function damageRoll(formula) {
>       ...
>     }
>     ```
- **Naming**:
>   * Variables & functions: camelCase
>   * Classes / constructors: PascalCase
>   * Constants: UPPER_SNAKE_CASE
>   * Files: kebab-case, all lowercase
- **Error handling**:
>   * Use `throw new Error(message)` for unrecoverable errors.
>   * Wrap async operations in `try/catch` and log with `fancyLog()`.
- **Logging**: Runtime logs go through `fancyLog()` from the CLI package. Do not use `console.log` in production code.
- **Testing hooks**:
>   * If you add tests, keep them in a dedicated folder to avoid accidental commits of test data.

## Cursor & Copilot Rules
- No `.cursor/rules/` or `.cursorrules` directories are present.
- Copilot instructions live in `.github/copilot-instructions.md`. Key takeaways:
>   * Avoid generating large blocks of code without comments.
>   * Prefer concise, focused snippets.
>   * Use JSDoc for public APIs.
>   * Do not add emoji or decorative text unless explicitly requested.

## Miscellaneous
- **Assets**: All packs, tokens, and images reside under `packs/` or `tokens/`.
- **Entry point**: The module's main file is `dnd5e.mjs`.
- **Compiled bundle**: Generated as `dnd5e-compiled.mjs`; this file should remain untracked in source control.
- **Package.json scripts**:
>   * `build`: runs code, CSS, and DB build steps.
>   * `lint`: lints all `.mjs` files.
>   * `watch`: watches LESS for changes.

## Quick Reference Table
| Task | Command |
|------|---------|
| Clean cache | `source .venv/bin/activate && npm run build:clean` |
| Rebuild all | `source .venv/bin/activate && npm run build` |
| Lint only | `source .venv/bin/activate && npm run lint` |
| Auto‑fix | `source .venv/bin/activate && npm run lint:fix` |
| Watch styles | `source .venv/bin/activate && npm run watch` |

---

**Tip**: After any change, run `source .venv/bin/activate && npm run lint && npm run build` to ensure code quality and a fresh bundle.