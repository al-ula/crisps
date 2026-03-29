# AGENTS.md

## Package Manager

- Use `pnpm` instead of `npm` for all package management tasks.

## UI Theming

- Follow the existing theme system before adding new UI styling.
- Prefer existing design tokens, CSS variables, and shared utility classes over new one-off values.
- Avoid hard-coded visual values for theme-sensitive properties such as border radius, colors, shadows, spacing, and overlays when an existing token or shared style already exists.
- When styling editor UI, match established surfaces like `card-frosted`, shared radius variables such as `var(--radius-box)` / `var(--radius-field)`, and existing editor variables in `src/editor/milkdownTheme.css`.
- If a new visual token is genuinely needed, add it in the shared theme layer instead of embedding a raw value in a single component.
