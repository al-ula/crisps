# Crisps

Markdown editor built with Tauri, React, and TypeScript.

## Development

- `pnpm dev`: run the Milkdown editor in the browser.
- `pnpm tauri dev`: run the Milkdown Tauri app.

## Production Builds

- `pnpm build`: build the Milkdown bundle.
- `pnpm tauri build`: build the Milkdown Tauri app.

## Smoke Test

1. Open an existing markdown file.
2. Edit the document and confirm the window dirty state changes.
3. Save the file.
4. Reopen it and confirm the saved markdown round-trips correctly.
