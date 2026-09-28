# Repository Guidelines

## Project Structure & Module Organization

- `src/cube-core.js` contains the 3×3×3 cube geometry, state operations, coordinate conversion, and Kociemba two-phase solver. It exports CommonJS in Node and `CubeCore` in browsers.
- `src/test-core.js` contains geometry checks, solver construction, random-scramble validation, and boundary cases.
- `src/debug/` holds historical diagnostic scripts; check their imports and API usage before running them.
- `STATUS.md` records progress, known issues, and rotation/state conventions. Rendering, the Three.js interface, and assets are not implemented yet.

## Build, Test, and Development Commands

Run commands from the repository root with Node.js:

- `node --check src/cube-core.js` checks core JavaScript syntax.
- `node src/test-core.js` runs the custom test script, including solver table construction and 50 random scrambles.
- `node --max-old-space-size=4096 src/test-core.js` runs the same checks with a 4 GiB heap limit for solver investigation.

There is no package manifest, dependency installation step, build pipeline, or development server. Historical debug scripts use `require('./cube-core.js')`, which does not resolve from `src/debug/`; correct it to `../cube-core.js` before use.

## Coding Style & Naming Conventions

Follow the core's two-space indentation, semicolons, and predominantly single-quoted strings. Use `camelCase` for functions and local variables and `UPPER_SNAKE_CASE` for constant tables. Keep the core independent of rendering and compatible with both Node and browsers. No formatter or linter is configured.

Preserve `perm[pos]` as the original cubie ID and `ori[pos]` as its rotation matrix. In `applyTurn`, collect assignments before writing them back. Consult `STATUS.md` before changing rotation or coordinate conventions.

## Testing Guidelines

Tests use a local `ok` helper and process exit status; no testing framework or coverage threshold is configured. Add descriptive regression assertions to `src/test-core.js`. Cover inverse moves, coordinate consistency, and replay of solver output to a solved state. Record exact scrambles for random failures.

Solver validation remains incomplete, and existing assertions and diagnostic APIs need review. Report failures explicitly; do not assume the current suite passes.

## Commit & Pull Request Guidelines

The sole existing commit uses `wip:` with a Chinese description; no broader convention is established. Use concise, descriptive commit subjects. In pull requests, explain the behavior changed, commands run, results, and remaining solver limitations. Link relevant issues and update `STATUS.md` when progress or known problems change.
