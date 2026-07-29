# Brand Guide

ArkaForge brand application for the digital-twin demo. These are not suggestions. Deviations
require explicit justification. Applies to the React operator console and, where practical, to
the Unreal scene palette (stylized industrial, matte — never neon or photoreal-for-its-own-sake).

## Colors

Defined as CSS variables in the console (`console/app/globals.css`) and mirrored as Unreal
material parameters:

```css
:root {
  /* Brand */
  --forge-red:        #FF3B00;   /* accent only: alerts, critical state, CTAs */
  --void-black:       #0B0C0F;   /* primary background / scene base */

  /* Surfaces */
  --surface-1:        #14151a;   /* elevated panels */
  --surface-2:        #1c1e24;   /* nested panels */
  --border:           #2a2a2f;   /* default border, 1px */

  /* Text */
  --text-primary:     #f5f5f7;
  --text-secondary:   #a0a3aa;
  --text-tertiary:    #6c6f76;

  /* Status */
  --status-nominal:   #7ed957;   /* green: within limits */
  --status-warning:   #f5a623;   /* amber: approaching a limit */
  --status-critical:  #FF3B00;   /* reuse Forge Red for critical (intentional) */
}
```

### Usage rules

- **Forge Red** appears on no more than ~10–15% of any view. Use it for: critical asset state
  (e.g., transformer hot-spot over limit, BESS thermal margin breach), the agent recommendation
  highlight, critical alerts, and primary CTAs. Not for general accents, headings, or body text.
- In the **Unreal scene**, Forge Red is reserved for genuine alert states (a transformer heating
  into its limit, a line at over-rating). A healthy node is monochrome industrial.
- **Hover/active** on Forge Red: opacity 0.85. Do not introduce new hues.
- **No new colors** without justification in review. The palette is deliberately tight.

## Typography (console)

```css
--font-display:  'Bebas Neue', sans-serif;
--font-body:     'Inter', system-ui, -apple-system, sans-serif;
--font-mono:     'JetBrains Mono', 'SF Mono', Menlo, monospace;
```

| Element | Font | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Headline (hero) | Display | 56px | 400 | 0.02em |
| Section heading | Display | 28px | 400 | 0.03em |
| Body | Body | 16px | 400 | normal |
| Small body | Body | 14px | 400 | normal |
| Caption / label | Body | 12px | 500 | 0.05em uppercase |
| Telemetry value | Mono | 14px | 500 | normal |
| Timestamp | Mono | 11px | 400 | normal |
| Tagline | Display | 18px | 400 | 0.05em uppercase |

**Bebas Neue is display only.** Never body copy.

## Layout

- **Border radius:** 4px standard, 8px max. No pills except status badges.
- **Borders:** 1px solid `var(--border)`. No double/thick/dashed (dashed only for schematics).
- **Spacing (Tailwind):** prefer 2, 3, 4, 6, 8, 12, 16.
- **Shadows:** none. Elevation via surface color.
- **Gradients:** none in UI. (Unreal scene lighting is exempt — it is physical, not decorative.)

## Tagline

```
TRAIN IN SIMULATION. OPERATE IN REALITY.
```

- Bebas Neue, ALL CAPS, letter-spacing 0.05em, color `var(--text-secondary)`.
- Footer of the console, centered or left-aligned. Do not modify, abbreviate, or repunctuate.

## Iconography

- Tabler **outline** icons (16px or 20px), color inherited from parent text. Never filled.

## Motion

- Default transition 150ms ease-out; layout shifts 400ms ease-in-out.
- No bounce, spring, or decorative motion. The brand is precise.
- Scene animation (asset activity, thermal glow) is **physics-driven from twin state**, not
  decorative.

## Anti-Patterns (refuse in review)

- Multiple accent colors (only Forge Red).
- Colored body text (text is greyscale).
- Drop shadows; UI gradients; glow/neon/blur.
- Heavy display weights (>500); Title Case in UI (sentence case; tagline is the only ALL CAPS).
- Emoji in UI; stock-photo aesthetics.
- **Photoreal detail in the Unreal scene that does not aid comprehension of the twin.**
