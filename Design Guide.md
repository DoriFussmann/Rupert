# Design Guide

## 1. Brand identity
- **Name / tagline:** Rupert (by Dori Fussmann)
- **One-sentence description of the intended feel:** A seasoned operator's desk, not a SaaS dashboard. Plain, precise, quietly confident — the interface equivalent of a well-written cold email.
- **Mission statement:** Get founders in front of the investors who actually fund companies like theirs — expert-run outreach with full transparency, so the founder keeps every reply and every relationship.
- **Brand values:** Honesty (no guarantees, no tricks) · Craft (custom work, never templates) · Ownership (the client’s relationships, 100% of their raise) · Transparency (see everything) · Precision over spray.
- **Emotional goal — how visitors should feel:** Relief and earned confidence — "a professional has this."
- **Reference sites/brands/inspiration:** Plain-text email aesthetic; editorial finance restraint (FT / Stripe-docs level of quiet); anti-reference: typical agency/SaaS marketing gloss.

## 2. Color palette
- **Named palette (if no hex given):** _(not set)_
- **Primary color:** #2c4a6e
- **Secondary color:** #1a1a1a (≈64% opacity) [verify — no exact secondary hex in source, derived from ink]
- **Accent color:** #2f5eff
- **Background:** #ffffff
- **Surface:** #fafafa
- **Border:** #e6e6e6
- **Muted text:** #8a8a8a
- **Heading text color:** #1a1a1a (same as body ink, declared explicitly)
- **Body text color:** #1a1a1a
- **Success:** #1e7f4f
- **Warning:** #b45309
- **Error:** #2f5eff (accent doubles as error — no separate error token in source)
- **Dark mode required?** No
- **Minimum contrast ratio:** WCAG AA (4.5:1 body / 3:1 large)

## 3. Typography
- **Heading font:** Inter (var(--font-inter)), same family as body — differentiated by size not weight
- **Body font:** Inter (var(--font-inter)), fallback system-ui, sans-serif — weight 400 only
- **Monospace font:** Inter with tabular-nums for stats/tables; JetBrains Mono only if literal code/IDs appear
- **Typographic feel:** Quiet, editorial, engineered
- **Type scale:** Extracted from code: hero/display 48px, page title 15px, card title 13px (forced 400), body 13px, mobile brand 24px. [verify] Proposed fuller scale for new surfaces — H1 32 / H2 24 / H3 20 / H4 17 / body 15 / small 13 — does NOT match the extracted sizes above; reconcile before using.
- **Line height:** Body 1.5 (proposed) — extracted login subcopy used 1.625
- **Font weights in use:** Source forces weight 400 everywhere (`font-weight:400 !important` on `*`, no bold). [verify] Proposed allowance of weight 500 for headings would require relaxing that global rule.

## 4. Spacing & layout
- **Base spacing unit:** 4px — multiples of 4, prefer 8/12/16/24/32
- **Max content width (article body):** max-w-3xl (48rem / 768px) content column
- **Container/page max width:** max-w-[1280px] shell (extracted). [verify] Proposed grid below cites 1200px — pick one.
- **Breakpoints:** sm 640 / md 768 / lg 1024 / xl 1280 — keeps the existing `md` breakpoint used in code
- **Grid/column system:** 12-column, 1200px max content width, single column below md [verify against 1280px container width above]

## 5. Component styling direction
- **Buttons:** Ghost/outlined only, no filled primary: rounded-lg border border-line px-3 py-2 text-muted hover:text-ink disabled:opacity-40; compact variant px-3 py-1.5
- **Cards:** bg-white, 1px solid #e6e6e6 border, rounded-xl (8px), no shadow; header/body px-4 py-3; header hover:bg-soft; expand via grid-template-rows 0→1fr, 0.28s ease-out
- **Forms:** Inputs rounded-lg border-line px-3 py-2; password fields add pr-10 with eye toggle (text-muted hover:text-ink); placeholder #b5b5b5; outline:none
- **Navigation:** Left nav items: w-full rounded-lg (6px) border px-3 py-2 text-left; default border-line text-muted hover:bg-soft hover:text-ink; active border-line bg-soft text-ink
- **Footer:** Minimal single row — brand, © Rupert 2026, nothing else. Gated tool, no marketing nav.
- **Links within body text:** Ink text, underlined, accent (#2f5eff) on hover — never color-only for state

## 6. Imagery & photography
- **Photography style (overall):** None — this product is text and data, no photography system
- **Typical subjects/scenes:** N/A
- **Lighting & mood to use:** N/A
- **What to avoid in photography:** N/A
- **Icon set:** Lucide, 1.5px stroke, 16/20px sizes only
- **Image treatment:** None

## 7. Illustration style
- **Illustration characteristics:** None. If a concept needs explaining, use words.
- **Illustration themes/subjects:** N/A

## 8. Tone & motion
- **Overall visual tone:** Direct, plain, expert, calm, honest
- **Animation/motion level:** Subtle
- **Specific animation/motion ideas:** Transitions only where they communicate state — the existing 0.28s panel expand (grid-template-rows, ease-out) is the ceiling, not the floor. 150–300ms, ease-out. Chevron rotates 180° on expand (200ms). No decorative motion.
- **Explicitly avoid (visual style):** Hype, agency-speak, exclamation points, emoji, "revolutionary/game-changing/unlock," apologetic hedging

## 9. Brand voice & copywriting
- **Writing tone:** Minimal, direct — no explanatory UX copy
- **Words/phrases to avoid:** Hype, agency-speak, exclamation points, emoji, "revolutionary/game-changing/unlock," apologetic hedging
- **Example preferred phrases:** "Email", "Password", "Continue", "Sign out", "Saved". One allowed helper-line style: "Access is managed by your administrator."

## 10. Page structure & hero copy
- **Homepage section order:** N/A by design — gated tool, no marketing surface. The marketing site (heyrupert.com) owns hero/homepage.
- **Hero headline:** N/A — see homepageSections
- **Hero subheadline:** N/A — see homepageSections
- **Primary CTA text:** N/A — see homepageSections

## 11. Accessibility requirements (non-negotiable baseline)
- Minimum contrast ratio: WCAG AA (4.5:1 body / 3:1 large)
- Focus state: Visible 2px accent (#2f5eff) focus ring, 2px offset, on all interactive elements — never outline:none without a replacement style
- Minimum tap target: 44×44px minimum touch targets
- Zoom readability: Fully usable at 200% browser zoom; no fixed-height text containers

## 12. Explicit anti-patterns
No bold weights · no drop shadows · no filled buttons (outline/ghost only) · no gradients · no decorative animation · no marketing copy inside the app · no color-only state indicators · no dark mode
