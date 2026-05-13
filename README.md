# swarmnote-editor

A Markdown-first, live-preview editor built on CodeMirror 6, used by
SwarmNote desktop (Tauri) and mobile (Expo + React Native) hosts.
Designed to be host-agnostic and eventually publishable as a standalone
open-source editor stack.

## Packages (v0.2)

This repository is a **pnpm workspace monorepo**. As of v0.2 it ships
four packages with explicit platform boundaries:

| Package                            | Role                                                                    | Desktop host | RN host                |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------ | ---------------------- |
| `@swarmnote/editor-core`           | Platform-agnostic CodeMirror 6 kernel + Plugin SDK (`/plugin` subpath). | direct       | type-only / WebView    |
| `@swarmnote/editor-web`            | WebView runtime + Comlink endpoint + single-file `dist/index.html`.     | —            | bundled into the app   |
| `@swarmnote/editor-react`          | React component library (EditorView / EditorToolbar / I18nProvider).    | direct       | —                      |
| `@swarmnote/editor-react-native`   | RN bridge library (useEditorBridge / useEditorFormatting / I18n).       | —            | direct                 |

**Design philosophy** — `editor-react` and `editor-react-native` are
**independent component libraries** (chakra / radix-ui style), not host
component migration targets. Hosts can adopt the bundled components,
extend them, or roll their own using `@swarmnote/editor-core` directly.

**Singleton constraints** — All UI libs that interact with the host
render tree (`react`, `react-dom`, `react-native`, `lucide-react`,
`@radix-ui/*`, `@rn-primitives/*`, `nativewind`, …) are declared as
`peerDependencies`. Hosts own the version; sibling packages never bring
their own.

## Repo layout

```text
swarmnote-editor/
├── pnpm-workspace.yaml          # workspace manifest
├── package.json                 # workspace root (private)
├── tsconfig.base.json           # shared TS compilerOptions
└── packages/
    ├── editor-core/             # @swarmnote/editor-core  (public, plugin SDK)
    ├── editor-web/              # @swarmnote/editor-web   (private, WebView bundle)
    ├── editor-react/            # @swarmnote/editor-react (public, desktop UI)
    └── editor-react-native/     # @swarmnote/editor-react-native (public, RN bridge)
```

## Getting Started

```bash
# 1. Clone
git clone https://github.com/swarm-apps/swarmnote-editor.git
cd swarmnote-editor

# 2. Install
pnpm install

# 3. Build all packages
pnpm -r build
```

Requires Node ≥ 22 and pnpm ≥ 10.

`editor-web/dist/index.html` is **gitignored** — RN hosts must run
`pnpm --filter @swarmnote/editor-web build` (in this repo) before
starting Metro, otherwise the WebView resource is missing.

## Local Development with a host repo

Both hosts (`SwarmNote` desktop, `SwarmNote-RN` mobile) wire this repo
in via `pnpm.overrides` with a relative `link:` protocol. Clone this
repo as a sibling of the host repos and they auto-link on `pnpm install`:

```text
parent/
├── swarmnote-editor/      ← this repo
├── SwarmNote/             ← Tauri desktop host
└── SwarmNote-RN/          ← Expo / RN host
```

For continuous editor development, run watch builds:

```bash
# Watch editor-core (used by all three other packages)
pnpm --filter @swarmnote/editor-core dev

# Watch editor-web (the host re-bundles index.html on save)
pnpm --filter @swarmnote/editor-web dev
```

### Host-side wiring (already configured in the host repos)

- **Desktop SwarmNote** — `pnpm.overrides` points `@swarmnote/editor-core` and
  `@swarmnote/editor-react` at `link:../swarmnote-editor/packages/*`. Tailwind 4
  `@source` directive (in `src/App.css`) scans the sibling `editor-react/dist`
  for class names.
- **SwarmNote-RN** — `pnpm.overrides` covers `editor-core`, `editor-web`, and
  `editor-react-native`. Metro `watchFolders` covers the sibling repo root
  (not just `packages/*`) so it can read the pnpm `.pnpm/` store.
  `resolver.resolveRequest` pins `react` / `react-native` / `scheduler` to the
  host `node_modules` to avoid double-React. See SwarmNote-RN's
  `dev-notes/knowledge/editor.md` for the three coupled metro pitfalls.

Override the default sibling path with environment variables:

```bash
# Desktop
SWARMNOTE_EDITOR_LOCAL_PATH=/custom/path pnpm tauri dev

# RN
SWARMNOTE_EDITOR_LOCAL_PATH=/custom/path npx expo start --clear
```

## Status

These packages are **not yet published to npm**. Both host repos consume
them via `pnpm.overrides` during local development. First-publish
planning lives in the SwarmNote main repo under `openspec/` and
`dev-notes/plans/`.

## License

MIT
