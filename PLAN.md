# Milkdown Migration Plan

## Goal

Migrate the editor from `@mdxeditor/editor` to Milkdown without regressing file handling, source mode, menu actions, or the current custom editor UX.

## Current State

- `src/components/EditorHost.tsx` now defaults to `MilkdownEditor`, with `MdxEditor` still available behind `VITE_EDITOR_ENGINE=mdx`.
- File state and save logic in `src/context/FileContext.tsx` now depend on `EditorAdapter`, not `MDXEditorMethods`.
- Menu and Tauri actions are still bridged through `src/components/FloatingBar.tsx`, `src/editor/tauriBridge.ts`, and `src-tauri/src/lib.rs`.
- The Milkdown path exists in `src/components/MilkdownEditor.tsx` with markdown sync, state snapshots, and action handling.
- The old MDXEditor/Lexical overlays remain for fallback and still drive:
  - `src/components/MdxEditor.tsx`
  - `src/plugins/blockHandlePlugin.tsx`
  - `src/plugins/selectionFormatPlugin.tsx`
- Styling now includes both MDXEditor-specific selectors and Milkdown overrides in `src/App.css`.

## Migration Strategy

Use a staged swap, not a one-shot rewrite.

- Keep the existing app shell, Tauri commands, and file workflow.
- The editor adapter and feature-flagged host already exist, so the remaining work is parity and cutover.
- Keep Milkdown available behind the flag until command wiring, source mode, and markdown roundtrips are stable.
- Rebuild the custom overlays against Milkdown and ProseMirror only after the core editor flow is working.
- Remove MDXEditor and Lexical only after parity is acceptable.

## Progress Snapshot

- Done: PR 1, PR 2, PR 3.
- In progress: PR 4, PR 5, PR 8.
- Pending: PR 6, PR 7, PR 9, PR 10.

## Backlog

### PR 1: Editor contract extraction

Status: done.

Scope:
- Remove direct `MDXEditorMethods` usage from `src/context/FileContext.tsx`.
- Define a small editor adapter interface with methods like:
  - `setMarkdown`
  - `getMarkdown`
  - `focus`
  - `runAction`
  - `subscribeState`

Acceptance:
- `src/App.tsx` and `src/components/FloatingBar.tsx` do not need to know whether the backing editor is MDXEditor or Milkdown.

### PR 2: Milkdown spike behind a feature flag

Status: done.

Scope:
- Add Milkdown packages.
- Create `src/components/MilkdownEditor.tsx`.
- Mount Milkdown behind a local flag while keeping MDXEditor as fallback.

Acceptance:
- Load initial markdown.
- Emit markdown changes.
- Support focus.
- Open, edit, save, and reopen a file successfully.

### PR 3: Markdown and state bridge parity

Status: done.

Scope:
- Connect Milkdown listeners to dirty tracking and source mode.
- Update file context logic so it uses the editor adapter instead of `editorRef.current?.setMarkdown(...)`.

Acceptance:
- `new`, `open`, `save`, `save as`, dirty indicator, close confirm, and source-mode roundtrip all work.

### PR 4: Command bridge migration

Status: in progress.

Scope:
- Keep the current Tauri event contract.
- Reimplement the editor side with Milkdown commands and listeners.

Acceptance:
- The following actions work through Milkdown:
  - undo
  - redo
  - bold
  - italic
  - underline
  - strikethrough
  - inline code
  - headings
  - quote
  - bullet list
  - ordered list
  - checklist
  - remove list
  - link
  - table
  - image
  - thematic break

### PR 5: Feature gap decisions

Status: in progress.

Scope:
- Resolve features that may not map cleanly before deeper UI work.

Decision items:
- frontmatter support
- checklist behavior parity
- image upload behavior
- code block language UX

Acceptance:
- Each item is implemented, replaced, or intentionally dropped with rationale.

### PR 6: Selection toolbar rewrite

Status: pending.

Scope:
- Replace the current selection formatting overlay with a Milkdown and ProseMirror implementation.

Acceptance:
- Popup positioning works.
- Active mark state stays in sync.
- Block type switching works.
- Link, code block, and table actions still work.

### PR 7: Block handle rewrite

Status: pending.

Scope:
- Replace the current block handle overlay with a Milkdown and ProseMirror implementation.

Acceptance:
- Hover and caret block detection work.
- The block menu supports:
  - turn into
  - insert below
  - move up
  - move down
  - delete block

### PR 8: Styling and theming port

Status: in progress.

Scope:
- Remove MDXEditor-specific CSS.
- Restyle Milkdown output to match the current Catppuccin-based UI.

Acceptance:
- No remaining `.mdxeditor*` selectors.
- Editor layout, typography, popups, and code blocks are visually aligned with the current app.
- Light and dark themes both work.

### PR 9: Regression coverage

Status: pending.

Scope:
- Add a manual test matrix and, if worthwhile, lightweight automated coverage around markdown roundtrips.

Test cases:
- headings
- nested lists
- checklists
- tables
- code fences
- images
- frontmatter
- source-mode toggle
- undo and redo
- open and save flows

Acceptance:
- The same input markdown produces acceptable saved markdown after edit cycles.

### PR 10: Cutover and cleanup

Status: pending.

Scope:
- Flip the feature flag.
- Remove MDXEditor, Lexical, and old bridge code after parity is confirmed.

Acceptance:
- The app builds cleanly with no MDXEditor or Lexical dependencies left.

## Recommended Order

1. PR 1
2. PR 2
3. PR 3
4. PR 4
5. PR 5
6. PR 6
7. PR 7
8. PR 8
9. PR 9
10. PR 10

## Main Risks

- `frontmatter` is currently first-class in the editor and may need custom Milkdown work.
- The custom overlays currently depend on Lexical behavior and will need full rewrites.
- A meaningful part of the current visual presentation comes from MDXEditor-specific CSS and CodeMirror-specific styling.

## Definition of Done

- Milkdown replaces MDXEditor for the main editing experience.
- File operations and dirty tracking behave the same or better.
- Source mode remains functional.
- Menu and Tauri actions still work.
- Block handle and selection toolbar behavior are restored or intentionally revised.
- Saved markdown output is stable for the supported feature set.
