# Milkdown Migration Complete

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
- The current Milkdown path in `src/components/MilkdownEditor.tsx` no longer depends on Crepe for runtime behavior, LaTeX support, or theme CSS.
- Editor theming is now app-owned and aligned to DaisyUI tokens through `src/editor/milkdownTheme.css`.
- The migration work is complete; only ongoing regression validation and polish remain as normal product maintenance.

## Migration Strategy

Use a staged swap, not a one-shot rewrite.

- Keep the existing app shell, Tauri commands, and file workflow.
- The editor adapter and single-editor host already exist, and the migration work is now focused on parity validation rather than remaining Crepe ports.
- Rebuild the custom overlays against Milkdown and ProseMirror only after the core editor flow is working.
- Finish removing legacy migration scaffolding as parity lands.
- Keep visual review and functional review as manual sign-off steps rather than separate tracked tasks.

## Completion Snapshot

- Done: Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, MDX fallback removal.
- In progress: None.
- Pending: None.

## Completed Work Log

### Task 1: Editor contract extraction

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

### Task 2: Milkdown spike behind a feature flag

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

### Task 3: Markdown and state bridge parity

Status: done.

Scope:
- Connect Milkdown listeners to dirty tracking and source mode.
- Update file context logic so it uses the editor adapter instead of `editorRef.current?.setMarkdown(...)`.

Acceptance:
- `new`, `open`, `save`, `save as`, dirty indicator, close confirm, and source-mode roundtrip all work.

### Task 4: Command bridge migration

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

### Task 5: Feature gap decisions

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

### Task 6: Selection toolbar rewrite

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

### Task 7: Migrate off Crepe shell

Status: done.

Scope:
- Replace the Crepe-owned `new Crepe(...)` editor bootstrap with an app-owned Milkdown editor setup.
- Recreate the current runtime responsibilities now handled by Crepe, including:
  - editor creation and teardown
  - listener registration for mount, focus, blur, selection, update, and markdown changes
  - markdown replacement and markdown serialization flow
  - command execution wiring used by the adapter and Tauri action bridge
- Preserve the current adapter contract, frontmatter handling, markdown sync behavior, source mode integration, and selection/link popup integrations.
- Port or rewire the Crepe-backed feature setup currently relied on by the editor bootstrap, including code block/editor integrations and image upload behavior, so accepted Task 5 behavior does not regress during the shell cutover.
- Reimplement the block-edit foundation in app-owned Milkdown/ProseMirror code so later block UI work no longer depends on Crepe runtime behavior.

Acceptance:
- The app no longer depends on Crepe runtime bootstrapping or Crepe-managed editor lifecycle.
- Markdown load, edit, save, reopen, and source-mode roundtrip still work.
- Editor action dispatch still works through the existing adapter and Tauri bridge.
- Existing custom selection toolbar and custom link popup continue to function after the bootstrap swap.
- Code block language UX and image insertion/upload behavior continue to match the accepted migration behavior.
- Editor mount, unmount, and re-create flows clean up and reinitialize correctly without duplicate listeners or stale state.
- The internal block-edit behavior needed for later block UI work is owned by app code rather than Crepe runtime behavior.

### Task 8: Implement LaTeX without Crepe

Status: done.

Scope:
- Replace the remaining Crepe LaTeX runtime dependency with an app-owned Milkdown LaTeX implementation.
- Port the current inline math node, markdown parsing/serialization, input rules, and code block preview behavior into app-owned editor modules.
- Preserve current inline LaTeX toggle behavior and markdown output compatibility while removing the Crepe LaTeX feature import.
- Keep LaTeX styling compatible with the app-owned editor theme.

Acceptance:
- The app no longer imports any Crepe LaTeX runtime feature.
- Inline LaTeX insertion, editing, and toggle behavior still work.
- Math markdown roundtrips correctly for inline math and LaTeX block/code preview behavior.
- Existing command and selection flows do not regress after the LaTeX port.

### Task 9: Crepe block-edit handle replacement with unified block menu

Status: done.

Scope:
- Reimplement the Crepe block-edit handle behavior with app-owned UI on top of the block-edit foundation introduced in Task 7.
- Detect the active block and anchor a custom block control beside it.
- Replace the built-in `+` affordance with a custom menu trigger instead of a dedicated add-only control.
- Wire the custom block control to the app-owned block-edit commands introduced in Task 7.
- Expand the custom block control into a unified block menu that handles both add and change actions.
- Replace the remaining built-in block-edit menu behavior with app-owned UI.
- Support block-level transforms and block management actions from one menu surface using the app-owned block-edit foundation introduced in Task 7.

Current implementation status:
- `src/components/MilkdownEditor.tsx` now owns block hover detection, caret-derived block tracking, menu-owned block targeting, drag state, drop cue rendering, and editor-viewport drag auto-scroll.
- `src/editor/blockEdit.ts` now owns block resolution, block target DOM lookup, custom side-handle anchoring, drop-target resolution, and block move execution without relying on `@milkdown/kit/plugin/block` runtime behavior.
- `src/editor/milkdownRuntime.ts` no longer wires the Milkdown block plugin into runtime behavior for side handles or drag/drop.
- The side handle can now open the unified block menu and drag blocks without requiring the old Crepe provider path.
- Custom drop cues render for before, after, and inside placements, and dragging near the top or bottom of the editor viewport auto-scrolls the editor so offscreen drops are possible.
- Tables now resolve as active blocks for the side handle path.
- Recent handle-targeting fixes now keep the hovered block stable while moving from content into the side handle gutter, so text blocks no longer snap back to the caret block during the hover-to-handle transition.
- Post-change verification still passes with `npx tsc --noEmit` and `npm run build`.

Acceptance:
- Hover and caret block detection work for the custom block control.
- The custom block menu opens reliably at the active block.
- Insert-below style block creation works through the custom UI.
- The unified block menu supports:
  - turn into
  - insert below
  - move up
  - move down
- delete block
- Add and change actions are reachable from the same block-level UI.

Current acceptance coverage:
- Satisfied:
  - Hover and caret block detection now work for the custom block control.
  - The custom block menu opens from the app-owned side handle.
  - Hovering a text block and moving into its handle no longer drops the visible handle back to the caret block.
  - Insert-below, change actions, move up, move down, and delete all route through the unified app-owned block menu.
  - Drag now shows an app-owned drop cue and can move blocks within the current viewport and to offscreen positions via auto-scroll.
  - Image blocks are signed off for non-text parity.
  - Thematic breaks now resolve for hover and node-selection handle anchoring.

### Task 10: Cutover and cleanup

Status: done.

Scope:
- Complete the post-cutover cleanup after parity is confirmed.
- Remove MDXEditor, Lexical, and old bridge code.
- Remove the final direct Crepe dependency after replacing its remaining theme CSS with app-owned, DaisyUI-driven editor styling.

Acceptance:
- The app builds cleanly with no MDXEditor, Lexical, or Crepe dependencies left.
- The editor theme is app-owned and sourced from DaisyUI tokens rather than Crepe theme imports.

## Remaining Follow-Up

- None.

## Residual Risks

- `frontmatter` is currently first-class in the editor and may need custom Milkdown work if edge cases show up.
- Visual polish and regression validation now depend on manual review rather than tracked implementation tasks.

## Completion Criteria

- Milkdown replaces MDXEditor for the main editing experience.
- File operations and dirty tracking behave the same or better.
- Source mode remains functional.
- Menu and Tauri actions still work.
- The editor runtime and theme no longer depend on Crepe.
- Block add and block change behavior are restored through app-owned Milkdown UI.
- Saved markdown output is stable for the supported feature set.
