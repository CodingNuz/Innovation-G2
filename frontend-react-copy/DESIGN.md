---
version: alpha
name: "SpamChameleon"
description: "A calm, system-native threat-detection app: neutral surfaces, one blue accent, status colours that mean something, and a probability ring as the signature."
colors:
  bg: "#F5F5F7"
  surface: "#FFFFFF"
  label: "#1D1D1F"
  label-2: "#6E6E73"
  accent: "#0071E3"
  accent-text: "#0066CC"
  threat: "#FF3B30"
  threat-text: "#D70015"
  safe: "#34C759"
  safe-text: "#1D7F35"
  warn: "#FF9500"
  warn-text: "#8A4B00"
  bg-dark: "#000000"
  surface-dark: "#1C1C1E"
  label-dark: "#F5F5F7"
  label-2-dark: "#A1A1A6"
  accent-dark: "#0A84FF"
  accent-text-dark: "#2997FF"
  threat-dark: "#FF453A"
  safe-dark: "#30D158"
  warn-dark: "#FF9F0A"
typography:
  sans:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Helvetica Neue, Segoe UI, Roboto, sans-serif"
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
rounded:
  DEFAULT: "12px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  pill: "999px"
spacing:
  sidebar-width: "248px"
  page-max: "1180px"
  gutter: "clamp(16px, 3.2vw, 44px)"
components:
  button: { }
  card: { }
  dialog: { }
  verdict: { }
  list-group: { }
  table: { }
---

# SpamChameleon Design System

## Overview

### Creative North Star

A **security instrument built like a system app**. It should feel at home next to Mail and Settings: quiet neutral surfaces, system type, standard patterns for navigation and controls. Identity lives in three places only: the chameleon-eye mark, the home hero's light-ripple shader, and the **probability ring**, the one custom element, which turns every model result into the same legible picture: a ring filled to the probability, the verdict word beside it.

The earlier cream-and-serif and near-black-and-lime directions were replaced: both are common generated-interface defaults with no root in this product. The platform, not a house style, is the reference here (Apple HIG: Familiarity, Simplicity, Craft).

### Product context and register

- **Audience and primary job:** Students, markers and security-curious users running three trained ML models (spam text, malware features/files, process context switches) and a tool-calling assistant, then reviewing the session's predictions.
- **Target market(s) and evidence:** Not market-specific. University machine-learning project; no Japan-market or regulated-flow contract applies.
- **Locale(s) and language policy:** English (en). Numbers and dates use the browser locale through `Intl`.
- **Usage scene:** Desktop-first demos with phone checks. Short sessions, moderate density, results read at a glance.
- **Register:** Product (application); the home route is a brand surface using the same tokens.
- **Memorable signature:** The probability ring with the verdict word (`components/Report.jsx`). Supporting moment: the shader hero on home.
- **Restraint:** Everything else is standard: sidebar, grouped lists, switches, search field, bubbles. No second accent, no decorative gradients in content.
- **Anti-references:** Cream/serif editorial defaults, acid-accent-on-black "hacker" dashboards, neumorphism, content-layer glass.
- **Token ownership/runtime mapping:** `src/styles/tokens.css` is the canonical runtime source and mirrors the frontmatter by hand (no generator). `src/charts/setup.js` reads chart colours from those custom properties when a chart is built, so there is no second copy. Change a value here and in tokens.css in the same edit.

## Colors

Semantic tokens, never appearance names; components do not choose light or dark values. The app follows the system appearance (light, dark, and Auto changing while it is open; the current screen rebuilds so charts pick up the new tokens). There is no in-app appearance switch.

Neutrals: `bg` is the page, `surface` is cards, `surface-sunk` is inset lists, `fill` and `fill-2` are control fills, `separator` is hairlines. Text steps: `label` (16.8:1 on white), `label-2` (5.1:1 on white, 4.6:1 on the page gray), `label-3` for large or non-essential text only.

`accent` means "interactive": primary buttons (white on #0071E3 is 4.7:1), links and selected-icon tint use `accent-text` (5.1:1 on the page gray). It is never used for status.

Status colours come in solid, `-text` and `-wash`: `threat` is spam, malware or an error; `safe` is ham, benign or a healthy backend; `warn` is out-of-range input and caution; neutral information uses the accent. Colour is always paired with a word (Spam, Benign) or an icon.

## Typography

One family: the system face (SF Pro on Apple devices), with system fallbacks elsewhere. Nothing is embedded. Scale follows the HIG text styles: Large Title 34 to 48 bold (page titles), Title 2 22 to 28 bold (section titles), Headline and Body 16 to 17, Callout and Subhead 15, Footnote 13, Caption 12 (minimum 11, ring label only). Display sizes (home headline, verdict word) use bold with negative tracking (-0.03em to -0.04em); body tracking is -0.011em. No light weights. Numerals are tabular wherever they change (counters, percentages, tables). Mono (system) is reserved for feature and counter names. Prose measure is capped near 62ch.

## Layout

A translucent sidebar (248px, desktop) groups destinations under short labels (Detect: Spam, Malware, Process; Assist: Assistant; Session: History) with Home on top. Below 960px it becomes a sticky translucent top bar plus a five-tab bottom bar (Home is reached through the brand mark, which keeps tabs at five). Content is capped at 1180px with a fluid gutter and a Large Title header on every route.

Model views use a two-column workbench from 1240px: input card, then the report column. The report column always exists: an empty state first, then the result, so nothing shifts. Narrower, the report stacks under the form and receives focus.

Scroll ownership: the document scrolls. The Assistant log and the Malware feature list are the only internal scrollers, both bounded; the History table scrolls horizontally in its own wrapper and becomes labelled cards under 720px.

## Elevation & Depth

Depth is surface contrast, not shadow: white cards on a gray page (light), raised gray cards on black (dark), 18 to 24px radius. Cards carry a hairline ring plus one very soft shadow. Materials (blur) appear only on the floating functional layer: sidebar, top bar, tab bar, sheet backdrop. Never in content. `prefers-reduced-transparency` turns them opaque.

## Shapes

Cards 18, hero and report 24 to 28, controls 12, list rows and inputs 8 to 12, chips and badges pill, brand mark 12 continuous-corner square. Icons are 1.75px-stroke outlines with round caps, sized to the adjacent text.

## Components

### Foundational visual states

Hover (slight brightness or fill change), `:focus-visible` (3px accent ring, 55% alpha, 2px offset; fields use a 4px accent wash), active (scale 0.97), disabled (40% opacity, `not-allowed`), busy (inline spinner at fixed button width). The default loading indicator is a spinner. Pointer cursor on every enabled button, link, summary and toggle row.

### Buttons and actions

Filled accent (primary), tinted gray (secondary, `butt-ghost`), tinted red (destructive, `butt-danger`), solid red only for the final confirmation. 40px high (44px on coarse pointers), 12px radius, semibold 15px. The hero uses the pill variant. Labels are title-style verbs that keep their name through the flow: Check, Scan File, Predict, Clear History.

### Navigation and data display

Sidebar items: 34px rows, accent-tinted icon, gray selected fill, `aria-current="page"`. The route is the URL hash. Each route sets `document.title` and moves focus to its heading. Tables are native `<table>` with hairline rows and verdict pills; History shows 20 rows with an explicit Show More.

### Forms and overlays

Native selects and native date inputs are an explicit decision: an OS popup is acceptable (English UI, short lists, no popup geometry in the visual contract). Forms use `noValidate` and own their messages. Textareas are `resize: none` with generous height. The search field is filled and rounded with a magnifier and, when non-empty, a clear button that returns focus. Binary features are inset-list rows with a real `role="switch"` checkbox. The About sheet is a native `<dialog>` with `showModal()` (focus trap, Escape, inert background, focus restoration) and a Done button. Destructive History clear is an inline confirmation, Cancel focused first.

### Iconography

One inline-SVG outline set (`components/Icon.jsx`), `aria-hidden` unless it is the only label; no icon font, no CDN.

### Motion

Brief and purposeful: 140ms control feedback, 280ms sheet and card transitions, a 1s ring fill and a short verdict fade when a result arrives, a staged reveal on the home page. The only continuous motion is the home hero's light-ripple shader (`components/ShaderAnimation.jsx`, three.js): blue tint on a near-black base, calm speed, one instance on the home route, lazy-loaded, paused while offscreen, a still frame under `prefers-reduced-motion`, and nothing at all if WebGL is unavailable. `prefers-reduced-motion` also removes the reveals, the ring animation and the chat typewriter.

### Content and data visualization

Plain English, title-style button labels, sentence-style helper text. Chart palette from the semantic tokens: threat and safe for verdict classes, accent for neutral and "set by you" series, warn for malware in cross-model views, gray for process. Each chart has a text alternative (the word chips, the ring readout, or an `aria-label`). Result probability is always the probability of the risky class (spam, malware), labelled as such.

## Do's and Don'ts

- **Do:** use the standard control for the job (list row, switch, search field, tab bar) before inventing one.
- **Do:** reuse `PageHead`, `ReportPanel`, `Verdict`, `Alert` and `Icon` rather than re-marking up a screen.
- **Do:** keep one meaning per colour: accent = interactive, red = threat, green = safe, orange = caution.
- **Don't:** put blur or glass in the content layer, add a second accent, add an in-app appearance toggle, or use light font weights.
- **Don't:** add a second shader instance, or put the shader or other continuous motion behind forms, tables or reports.

