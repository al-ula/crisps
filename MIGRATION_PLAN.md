# Milkdown Migration Plan

## Goal

Finish the Milkdown migration without regressing file handling, source mode, menu actions, or the current custom editor UX.

## Current State

- `src/components/EditorHost.tsx` now mounts only `MilkdownEditor`.
- File state and save logic in `src/context/FileContext.tsx` now depend on `EditorAdapter`, not `MDXEditorMethods`.
- Menu and Tauri actions are still bridged through `src/components/FloatingBar.tsx`, `src/editor/tauriBridge.ts`, and `src-tauri/src/lib.rs`.
- The Milkdown path exists in `src/components/MilkdownEditor.tsx` with markdown sync, state snapshots, and action handling.
- The MDXEditor/Lexical fallback and feature-flag cutover have already been removed.
- No `.mdxeditor*` selectors remain.
- Crepe's built-in selection toolbar is disabled and replaced with a custom Milkdown-backed selection toolbar and custom link popup.
- The block handle overlay is still the main large missing migration item, and final visual polish is still outstanding.

## Migration Strategy

Use a staged swap, not a one-shot rewrite.

- Keep the existing app shell, Tauri commands, and file workflow.
- The editor adapter and single-editor host already exist, so the remaining work is overlay parity, cleanup, and coverage.
- Rebuild the custom overlays against Milkdown and ProseMirror only after the core editor flow is working.
- Finish removing legacy migration scaffolding as parity lands.

## Progress Snapshot

- Done: PR 1, PR 2, PR 3, PR 4, PR 5, PR 6, PR 10, MDX fallback removal.
- In progress: PR 8.
- Pending: PR 7, PR 9.

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

Status: done.

Scope:
- Keep the current Tauri event contract.
- Reimplement the editor side with Milkdown commands and listeners.

Acceptance:
- The following actions work through Milkdown:
  - undo
  - redo
  - bold
  - italic
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

Status: done.

Scope:
- Resolve features that may not map cleanly before deeper UI work.

Decision items:
- frontmatter support
- checklist behavior parity
- image upload behavior
- code block language UX

Resolution:
- Frontmatter stays outside the Milkdown document tree and is preserved through `splitFrontmatter` / `joinFrontmatter`, with `insertFrontmatter` seeding an empty frontmatter block when missing.
- Checklist behavior is implemented by rewriting Milkdown list item `checked` attributes on top of bullet lists, which preserves markdown checklist output without depending on Lexical behavior.
- Image insertion keeps both URL entry and local upload, with local files converted to data URLs to match the existing self-contained markdown flow.
- Code blocks now use Milkdown's built-in CodeMirror language picker, backed by the old MDX language list, and toolbar insertion defaults new fences to `txt`.

Acceptance:
- Each item is implemented, replaced, or intentionally dropped with rationale.

### PR 6: Selection toolbar rewrite

Status: done.

Scope:
- Replace the current selection formatting overlay with a Milkdown and ProseMirror implementation.

Acceptance:
- Popup positioning works.
- Active mark state stays in sync.
- Block type switching works.
- Link actions work through the custom popup flow.
- The selection popup avoids the top floating bar and only appears for real text selections.
- The selection toolbar now intentionally focuses on inline formatting and link actions; table insertion stays in the main insert/menu flow.

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
- Align custom overlays and popups with the floating bar and the rest of the app chrome.

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

Status: done.

Scope:
- Flip the feature flag.
- Remove MDXEditor, Lexical, and old bridge code after parity is confirmed.

Acceptance:
- The app builds cleanly with no MDXEditor or Lexical dependencies left.

## Remaining Recommended Order

1. PR 7
2. PR 8
3. PR 9

## Main Risks

- `frontmatter` is currently first-class in the editor and may need custom Milkdown work if edge cases show up.
- The block handle overlay still needs a full Milkdown-native rewrite to replace the removed Lexical implementation.
- Styling still needs final alignment across editor chrome, popups, and code-block UI in both themes.

## Definition of Done

- Milkdown replaces MDXEditor for the main editing experience.
- File operations and dirty tracking behave the same or better.
- Source mode remains functional.
- Menu and Tauri actions still work.
- Block handle and selection toolbar behavior are restored or intentionally revised.
- Saved markdown output is stable for the supported feature set.
