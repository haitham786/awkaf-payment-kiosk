# Plan: Swap Arabic font + darken English text

## 1. Add the font file
- Copy `user-uploads://GE_SS_Two_Bold.otf` → `src/assets/fonts/GE_SS_Two_Bold.otf`.

## 2. Register the font in `src/index.css`
- Add a new `@font-face` for `GE SS Two` (weight 700, `font-display: swap`) pointing at the new OTF.
- Keep the existing Latin `AppBilingual` face (Arial) for English **unchanged**.
- Replace the **Arabic** `AppBilingual` face so it sources `GE SS Two` for the Arabic Unicode ranges (`U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF`).
- Result: existing `font-family: 'AppBilingual'` stack automatically routes Arabic glyphs to GE SS Two Bold and Latin glyphs to Arial — no component edits needed, every kiosk page picks it up.

## 3. Force English text to solid black
- In `src/index.css` `@layer base`, add a rule that targets Latin text inside kiosk pages and sets `color: #000`.
  - Approach: `body { color: #000; }` override is too broad (affects admin). Instead scope to kiosk:
    - Wrap rule in `:not(.admin-panel) :lang(en), :not(.admin-panel) [lang="en"]`, plus a default fallback so untagged English on kiosk pages also renders pure black.
  - Since most kiosk components don't carry `lang` attributes, simplest robust fix: set the global foreground token used by kiosk screens to pure black by overriding text utility on kiosk root. Concretely, add `color: #000` to `body` and let the admin panel rule (already scoped via `.admin-panel`) keep its own color — admin uses Tailwind `text-*` classes that won't be affected by the body color change.
- Admin panel styling stays as-is (already isolated via `.admin-panel` selectors).

## 4. Verify
- Reload `/auth` and a kiosk route; confirm:
  - Arabic renders in GE SS Two Bold.
  - English renders in Arial, solid black (`#000`).
  - Admin pages untouched.

## Files touched
- `src/assets/fonts/GE_SS_Two_Bold.otf` (new)
- `src/index.css` (font-face + color rule)

No component, route, or business-logic changes.
