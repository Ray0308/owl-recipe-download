# Food Platform Design System

Recipe Vault is moving toward a personal Food Platform. The interface should feel closer to a food magazine, recipe book, and restaurant guide than a SaaS dashboard.

## Principles

- Photos lead the experience. UI chrome should stay quiet.
- Registration must stay light. Do not add form fields unless they remove work later.
- Avoid dashboard density, decorative gradients, heavy shadows, and repeated boxed panels.
- Recipes and restaurants can share tokens, but their cards should remain distinct components.
- Mobile Safari is the primary environment.

## Tokens

Core tokens live in `style.css` under `:root`.

- Background: warm paper tones, mainly `--color-paper` and `--color-paper-warm`
- Text: charcoal `--color-ink`, secondary text `--color-muted`
- Accent: deep red `--color-red`, terracotta `--color-terracotta`, olive `--color-olive`
- Borders: thin warm gray lines, mostly `--border-hairline` and `--border-default`
- Radius: restrained, usually `--radius-sm` or `--radius-md`
- Shadow: rare and subtle, only for floating UI such as modal panels
- Photos: `--photo-ratio-card` for list items, `--photo-ratio-hero` for detail pages

## Typography

- Food titles use `--font-display` for a recipe-book tone.
- Body text uses `--font-body` for readability on iPhone.
- Do not scale body text with viewport width.
- Letter spacing remains `0`.

## Components

Defined CSS foundations:

- `app-header`
- `bottom-navigation`
- `search-bar`
- `filter-chip`
- `recipe-card`
- `restaurant-card`
- `photo-hero`
- `primary-button`
- `secondary-button`
- `icon-button`
- `favorite-button`
- `status-button`
- `section-header`
- `modal`
- `toast`
- `empty-state`

Current Recipe UI still uses existing selectors such as `recipe-item`, `hero-photo`, `tag`, and `card`. These are mapped to the same design tokens so Phase 2 can migrate gradually without breaking existing behavior.

## Card Rules

- Do not use one universal card for everything.
- `recipe-card` should prioritize food photo, recipe name, cooking time, and 1-2 tags.
- `restaurant-card` should prioritize shop or dish photo, shop name, area, genre, and status.
- Avoid showing IDs, versions, dates, and long descriptions in normal cards.

## Future UI Notes

- Bottom navigation should stay to: Home, Recipes, Add, Places.
- The add flow should ask only: Recipe or Restaurant.
- Toasts should report short operation results only.
- Modal use should be limited to focused choices, not long forms.
