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
- The current Milkdown path in `src/components/MilkdownEditor.tsx` no longer depends on Crepe for editor bootstrapping or lifecycle, but still keeps Crepe theme CSS and the Crepe LaTeX feature as temporary dependencies.
- The remaining tracked work is to replace the remaining Crepe-backed feature usage with app-owned Milkdown setup, then finish the block-level UI rewrite on top of that foundation.

## Migration Strategy

Use a staged swap, not a one-shot rewrite.

- Keep the existing app shell, Tauri commands, and file workflow.
- The editor adapter and single-editor host already exist, so the remaining tracked work is finishing the last Crepe-backed feature ports and the block-level overlay rewrite.
- Rebuild the custom overlays against Milkdown and ProseMirror only after the core editor flow is working.
- Finish removing legacy migration scaffolding as parity lands.
- Keep visual review and functional review as manual sign-off steps rather than separate tracked PRs.
- Keep `@milkdown/crepe` installed temporarily as a reference for feature implementations, editor bootstrapping behavior, and styles while equivalent app-owned Milkdown behavior is rebuilt.

## Progress Snapshot

- Done: PR 1, PR 2, PR 3, PR 4, PR 5, PR 6, PR 7, PR 11, MDX fallback removal.
- Pending: PR 8, PR 9, PR 10.

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

### PR 7: Migrate off Crepe shell

Status: done.

Scope:
- Replace the Crepe-owned `new Crepe(...)` editor bootstrap with an app-owned Milkdown editor setup.
- Recreate the current runtime responsibilities now handled by Crepe, including:
  - editor creation and teardown
  - listener registration for mount, focus, blur, selection, update, and markdown changes
  - markdown replacement and markdown serialization flow
  - command execution wiring used by the adapter and Tauri action bridge
- Preserve the current adapter contract, frontmatter handling, markdown sync behavior, source mode integration, and selection/link popup integrations.
- Port or rewire the Crepe-backed feature setup currently relied on by the editor bootstrap, including code block/editor integrations and image upload behavior, so accepted PR 5 behavior does not regress during the shell cutover.
- Reimplement the block-edit foundation in app-owned Milkdown/ProseMirror code so later block UI work no longer depends on Crepe runtime behavior.
- Keep `@milkdown/crepe` as a dependency temporarily as a reference for feature behavior, bootstrapping behavior, and styles during follow-up ports.

Acceptance:
- The app no longer depends on Crepe runtime bootstrapping or Crepe-managed editor lifecycle.
- Markdown load, edit, save, reopen, and source-mode roundtrip still work.
- Editor action dispatch still works through the existing adapter and Tauri bridge.
- Existing custom selection toolbar and custom link popup continue to function after the bootstrap swap.
- Code block language UX and image insertion/upload behavior continue to match the accepted migration behavior.
- Editor mount, unmount, and re-create flows clean up and reinitialize correctly without duplicate listeners or stale state.
- The internal block-edit behavior needed for later block UI work is owned by app code rather than Crepe runtime behavior.

### PR 8: Implement LaTeX without Crepe

Status: pending.

Scope:
- Replace the remaining `@milkdown/crepe/feature/latex` runtime dependency with an app-owned Milkdown LaTeX implementation.
- Port the current inline math node, markdown parsing/serialization, input rules, and code block preview behavior into app-owned editor modules.
- Preserve current inline LaTeX toggle behavior and markdown output compatibility while removing the Crepe LaTeX feature import.
- Decide whether Crepe theme CSS remains temporarily after the LaTeX port or whether PR 8 also moves the remaining editor styling needed by LaTeX into app-owned CSS.

Acceptance:
- The app no longer imports `@milkdown/crepe/feature/latex` at runtime.
- Inline LaTeX insertion, editing, and toggle behavior still work.
- Math markdown roundtrips correctly for inline math and LaTeX block/code preview behavior.
- Existing command and selection flows do not regress after the LaTeX port.

### PR 9: Add block UI rewrite

Status: pending.

Scope:
- Replace the built-in add-block affordance with the app's own block add UI.
- Detect the active block and anchor a custom add control beside it.
- Wire the add-block UI to the app-owned block-edit commands introduced in PR 7.

Acceptance:
- Hover and caret block detection work for block insertion affordances.
- The custom add UI opens reliably at the active block.
- Insert-below style block creation works through the custom UI.

### PR 10: Unified block menu

Status: pending.

Scope:
- Expand the custom block UI into a unified block menu that handles both add and change actions.
- Replace the remaining built-in block menu behavior with app-owned UI.
- Support block-level transforms and block management actions from one menu surface using the app-owned block-edit foundation introduced in PR 7.

Acceptance:
- The unified block menu supports:
  - turn into
  - insert below
  - move up
  - move down
- delete block
- Add and change actions are reachable from the same block-level UI.

### PR 11: Cutover and cleanup

Status: done.

Scope:
- Flip the feature flag.
- Remove MDXEditor, Lexical, and old bridge code after parity is confirmed.

Acceptance:
- The app builds cleanly with no MDXEditor or Lexical dependencies left.

## Remaining Recommended Order

1. PR 8
2. PR 9
3. PR 10

## Main Risks

- `frontmatter` is currently first-class in the editor and may need custom Milkdown work if edge cases show up.
- The remaining Crepe-backed LaTeX feature and theme CSS still need explicit removal or long-term retention decisions.
- The block UI rewrite depends on separating block-edit internals from Crepe runtime behavior before the final app-owned menus land.
- Visual polish and regression validation now depend on manual review rather than tracked implementation PRs.

## Definition of Done

- Milkdown replaces MDXEditor for the main editing experience.
- File operations and dirty tracking behave the same or better.
- Source mode remains functional.
- Menu and Tauri actions still work.
- The editor runtime no longer depends on Crepe's packaged shell, and remaining Crepe-backed feature usage is either removed or explicitly retained by decision.
- Block add and block change behavior are restored through app-owned Milkdown UI.
- Saved markdown output is stable for the supported feature set.
