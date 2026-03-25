# markdown-editor

Markdown editor built with Tauri, React, and TypeScript.

## Development

- `pnpm dev`: run the default MDXEditor build in the browser.
- `pnpm dev:milkdown`: run the Milkdown spike behind the feature flag.
- `pnpm tauri dev`: run the default MDXEditor Tauri app.
- `pnpm tauri:dev:milkdown`: run the Milkdown Tauri app.

## Production Builds

- `pnpm build`: build the default MDXEditor bundle.
- `pnpm build:milkdown`: build the Milkdown bundle behind `VITE_EDITOR_ENGINE=milkdown`.
- `pnpm tauri build`: build the default Tauri app.
- `pnpm tauri:build:milkdown`: build the Milkdown Tauri app.

## PR 2 Smoke Test

When running the Milkdown flag:

1. Open an existing markdown file.
2. Edit the document and confirm the window dirty state changes.
3. Save the file.
4. Reopen it and confirm the saved markdown round-trips correctly.
