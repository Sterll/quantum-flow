# Contributing

Thank you for considering a contribution to `@quantum-studios/flow`. This guide walks you through the development setup, project structure, and the conventions we follow so that your pull request has the best chance of being merged quickly.

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | 20 or later | Runtime for builds, tests, and Storybook |
| **pnpm** | 9 or later | Workspace-aware package manager used across the monorepo |
| **Git** | 2.40+ | Version control |

::: tip
If you do not have pnpm installed globally, you can enable it through Corepack (ships with Node 20):

```sh
corepack enable
corepack prepare pnpm@latest --activate
```
:::

## Clone and Install

```sh
git clone https://github.com/Sterll/Quantum-Flow-Lib.git
cd Quantum-Flow-Lib
pnpm install
```

The repository is a pnpm workspace with two packages:

```
Quantum-Flow-Lib/
  packages/
    flow/          # The library itself
    flow-docs/     # VitePress documentation site
  pnpm-workspace.yaml
```

## Development Workflow

### Build the library

```sh
cd packages/flow
pnpm build
```

This runs **tsup** and produces three outputs under `dist/`:

| Output | Format | Description |
|--------|--------|-------------|
| `index.js` | CJS | CommonJS bundle |
| `index.mjs` | ESM | ES module bundle |
| `index.d.ts` | DTS | TypeScript declarations |

### Run the tests

```sh
# Single run
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch
```

Tests use **Vitest** with the `jsdom` environment. The test suite currently contains **140+ tests** across **17 test files** covering every layer of the library (model, define, hooks, react, components).

### Start Storybook

```sh
pnpm storybook
```

Storybook 8 opens on `http://localhost:6006` and provides an interactive playground for `FlowCanvas` and the various hooks. Use it to visually verify your changes.

### Build Storybook

```sh
pnpm build-storybook
```

### Run the documentation site

```sh
cd packages/flow-docs
pnpm dev
```

This starts VitePress in development mode with hot-reload.

## Project Structure

```
packages/flow/
  src/
    types/         # FlowNode, FlowPin, FlowConnection, FlowGraph
    model/         # GraphStore, EventBus, Validator, HistoryManager
    define/        # defineNode, NodeRegistry
    hooks/         # useViewport, useNodeDrag, useConnection,
                   # useSelection, useHotkeys, useCanvasInteraction
    react/         # useFlowEditor, useGraphStore, useHistory,
                   # useClipboard, FlowProvider
    components/    # FlowCanvas
    index.ts       # Barrel export (public API surface)
  tests/           # 17 test files, 140+ tests
  package.json
  tsconfig.json
  tsup.config.ts
```

### Layer overview

| Layer | React dependency | Description |
|-------|-----------------|-------------|
| **types** | No | Pure TypeScript type definitions |
| **model** | No | Core data structures: `GraphStore`, `EventBus`, `Validator`, `HistoryManager` |
| **define** | No | Node blueprints: `defineNode()`, `NodeRegistry` |
| **hooks** | Yes | Low-level interaction hooks (viewport, drag, connections, selection, hotkeys) |
| **react** | Yes | High-level React API: `useFlowEditor`, `useGraphStore`, `useHistory`, `useClipboard`, `FlowProvider` |
| **components** | Yes | `FlowCanvas` -- Canvas 2D renderer |

## Making Changes

### 1. Create a branch

```sh
git checkout -b feat/my-feature
```

Use a descriptive branch name with a conventional prefix:

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring without behavior change |
| `docs/` | Documentation-only changes |
| `test/` | Test-only changes |

### 2. Write code

Follow the code style conventions below and make sure the existing tests still pass.

### 3. Add or update tests

Every new feature or bug fix should include tests. Place test files in `packages/flow/tests/` with the naming pattern `<ModuleName>.test.ts` (or `.test.tsx` for components that render React).

### 4. Run the full check

Before pushing, make sure everything passes:

```sh
pnpm build && pnpm test
```

### 5. Open a pull request

- Target the `main` branch.
- Write a clear title using conventional commit style (e.g., `feat(flow): add snap-to-grid option`).
- Include a short description of **what** changed and **why**.
- Reference any related issues.

## Code Style

### TypeScript

- The codebase uses **TypeScript 5** with strict mode enabled.
- Prefer explicit type annotations on public API surfaces (exported functions, hook return types).
- Use `interface` for object shapes and `type` for unions and intersections.

### No default exports

Every module uses **named exports** exclusively. This keeps auto-imports predictable and simplifies the barrel export in `index.ts`.

```typescript
// Good
export function useViewport() { /* ... */ }
export class GraphStore { /* ... */ }

// Bad
export default function useViewport() { /* ... */ }
```

### useCallback for hook returns

Functions returned from React hooks must be wrapped in `useCallback` (or `useMemo` for objects) so that consumers can safely include them in dependency arrays without unnecessary re-renders.

```typescript
// Good
export function useMyHook() {
  const doSomething = useCallback(() => {
    // ...
  }, [dependency])

  return { doSomething }
}
```

### Naming conventions

| Kind | Convention | Example |
|------|-----------|---------|
| Hooks | `use` prefix, camelCase | `useNodeDrag` |
| Classes | PascalCase | `GraphStore` |
| Types / Interfaces | PascalCase, prefixed with `Flow` for domain types | `FlowNode`, `FlowPin` |
| Test files | `<ModuleName>.test.ts` | `GraphStore.test.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_ZOOM` |

### General guidelines

- Keep functions small and focused.
- Avoid `any`. Use `unknown` when the type is truly unknown, and narrow with type guards.
- Prefer immutability: return new objects/arrays instead of mutating in place.
- Use descriptive variable names (as specified in the project instructions).

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]
```

**Examples:**

```
feat(flow): add snap-to-grid option to FlowCanvas
fix(flow): prevent duplicate connections on rapid double-click
docs(flow): update validator API reference
test(flow): add tests for batch undo/redo
refactor(flow): extract pin hit-testing into utility
```

## Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/Sterll/Quantum-Flow-Lib/issues) on GitHub. Include:

- A clear description of the problem or request.
- Steps to reproduce (for bugs).
- Expected vs. actual behavior.
- Library version and environment (browser, Node version).

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.
