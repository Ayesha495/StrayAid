---
name: StrayAid Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf4'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dbe9ff'
  surface-container-highest: '#d3e4fd'
  on-surface: '#0b1c2e'
  on-surface-variant: '#3f4945'
  inverse-surface: '#213144'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f7974'
  outline-variant: '#bec9c3'
  surface-tint: '#1d6a55'
  primary: '#00523f'
  on-primary: '#ffffff'
  primary-container: '#1e6b56'
  on-primary-container: '#9fe9ce'
  inverse-primary: '#8cd5bb'
  secondary: '#006c4f'
  on-secondary: '#ffffff'
  secondary-container: '#86f4c8'
  on-secondary-container: '#007153'
  tertiary: '#82271e'
  on-tertiary: '#ffffff'
  tertiary-container: '#a23e32'
  on-tertiary-container: '#ffcec7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a7f1d7'
  primary-fixed-dim: '#8cd5bb'
  on-primary-fixed: '#002118'
  on-primary-fixed-variant: '#00513f'
  secondary-fixed: '#89f7cb'
  secondary-fixed-dim: '#6cdab0'
  on-secondary-fixed: '#002116'
  on-secondary-fixed-variant: '#00513b'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4a9'
  on-tertiary-fixed: '#410000'
  on-tertiary-fixed-variant: '#82271d'
  background: '#f8f9ff'
  on-background: '#0b1c2e'
  surface-variant: '#d3e4fd'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
  headline-lg:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  badge:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1rem
  margin-lg: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an empathetic, responsive, and mission-driven visual identity tailored for stray animal rescue, emergency reporting, rehabilitation tracking, and pet adoption. It balances urgent crisis response with warmth and community compassion.

### Design Principles
- **Compassionate Urgency:** Visual hierarchy immediately distinguishes life-threatening emergency situations from long-term adoption updates through crisp, recognizable semantic tags.
- **Approachable Clarity:** High legible contrasts and generous touch targets eliminate cognitive strain during stressful reporting moments on the ground.
- **Tactile Softness:** Generous corner radii, pill tokens, and smooth containers humanize utility and foster trust between citizens, volunteers, and shelters.

### Movement & Style
The system adopts a **Modern Tactical-Organic** style. It leverages soft elevated cards, translucent status pills, high-contrast typography, and a grounded dual-surface palette anchored by deep rescue greens, warm urgency alerts, and soft botanical mint backgrounds.

## Colors

The palette balances authoritative medical urgency with welcoming community adoption tones.

### Palette Architecture
- **Primary (`#1E6B56` - Rescue Green):** Core actions, primary brand buttons, active navigation states, verified statuses, and high-emphasis interface chrome.
- **Secondary (`#35A982` - Emerald):** Tonal highlights, progress tracks, success toasts, verified rescues, and active step completions.
- **Tertiary (`#F47C6C` - Urgent Coral):** Critical alert states, high-severity rescue tags, emergency SOS buttons, and destructive confirmations.
- **Neutral (`#243447` - Slate Navy):** Primary typography, headings, structural icons, and deep dark-mode base surfaces.

### Semantic Tones & Status Chips
- **Amber (`#F4B860`):** Medium-severity cases, pending applications, and in-review actions.
- **Blue (`#4A90E2`):** Informational notes, AI recognition highlights, and interactive map pins.
- **Mint Surface (`#E7F4EE`):** Soft contextual backgrounds, selected chips, and primary surface tinting.
- **Neutral Accents:**
  - Supporting Text: `#747474`
  - Outline & Borders: `#E2E8F0`
  - Background Canvas: `#F8FAFC`
  - Card & Container Fill: `#FFFFFF`

## Typography

Typography pairs **Manrope** for structured, friendly, geometric headers with **Inter** for neutral, utilitarian body copy, inputs, and dense metadata.

### Hierarchy Application
- **Manrope Display & Headline:** Used across top app-bar headers, rescue case titles ("Injured Dog - G-11"), profile cards, and key stats.
- **Inter Body:** Powers multi-line rescue descriptions, narrative updates, and chat conversation streams.
- **Inter Label & Badge:** High-legibility, medium/bold weights applied across triage pills, adoption progress checkpoints, filter chips, and map markers.

## Layout & Spacing

A mobile-first 4-column fluid layout with 16px lateral padding ensures comfortable one-handed navigation and field entry.

### Layout Rules
- **Canvas Margins:** Fixed 16px (`1rem`) lateral margin for primary viewports, expanding to 24px (`1.5rem`) on larger screens or sheet containers.
- **Content Blocks:** Vertical rhythmic stacking operates on an 8px base rhythm. Form fields utilize `space-md` gaps, while primary narrative sections leverage `space-xl`.
- **Horizontal Scrolling:** Case filters, story avatars, and animal category chips use edge-to-edge overflow with inset padding to align with the main grid.

## Elevation & Depth

Visual hierarchy uses clean surfaces layered with soft, tinted ambient shadows rather than harsh borders.

### Surface Tiers
- **Level 0 (Canvas):** `#F8FAFC` base surface for background screens.
- **Level 1 (Card / Tile):** `#FFFFFF` surface accompanied by a diffused drop shadow: `0 2px 8px -2px rgba(36, 52, 71, 0.06), 0 1px 4px -1px rgba(36, 52, 71, 0.04)`.
- **Level 2 (Floating Action & Modal Sheets):** `0 8px 24px -4px rgba(36, 52, 71, 0.12)`, used for bottom sheets, navigation dock bars, and urgent floating emergency actions.
- **Level 3 (Overlay / Triage Popovers):** `0 16px 32px -6px rgba(36, 52, 71, 0.18)` for map callout cards and urgent verification dialogs.

## Shapes

The visual language combines generous corner rounding with pill-shaped active controls to feel safe, approachable, and responsive.

### Geometry Hierarchy
- **Pill (`9999px`):** Status indicators, triage tags, filter toggles, primary CTA buttons, and bottom dock navigation containers.
- **Large Cards (`rounded-lg` / `16px`):** Profile previews, adoption cards, and photo preview boxes.
- **Medium Inputs (`rounded` / `8px` - `12px`):** Text input containers, drop-downs, segmented control options, and map previews.
- **Circular (`50%`):** User story rings, camera upload buttons, and floating icon actions.

## Components

### Buttons
- **Primary Button:** Full-width or inline pill shape, solid `#1E6B56` fill, white `#FFFFFF` text, `14px` bold, 48px standard touch height.
- **Secondary / Outline:** Transparent fill, `1.5px` border in `#1E6B56`, label colored `#1E6B56`.
- **Critical Action:** Solid `#F47C6C` fill with white text for critical report triggers.
- **Circular Icon Button:** 40px × 40px circle, `#F8FAFC` or `#E7F4EE` surface with centered icons for bookmarking, calling, and sharing.

### Chips & Badges
- **Status Chips:** Full-pill shapes, 24px–28px height, 10px–12px bold labels with matching 6px circular dot markers:
  - *Reported:* `#F8FAFC` background, `#747474` border/text.
  - *In Progress:* `#E7F4EE` background, `#1E6B56` text.
  - *High / Critical Severity:* Light coral `#FDECE9` background with `#F47C6C` text and alert dot.
  - *Medium Severity:* Soft amber `#FEF6EB` background with `#F4B860` text.
  - *Adopted / Rescued:* Soft emerald `#E8F7F2` background with `#35A982` text.

### Cards
- **Rescue Card:** White base, 16px radius, subtle border (`#E2E8F0`), housing thumbnail, title, distance indicator, urgency badge, and AI confidence metric.
- **Pet Profile Card:** Edge-to-edge top image with 16px top corner radius, overlaid status badge, metadata row (breed, age, gender), and bottom action bar.

### Input Fields
- **Text Inputs & Dropdowns:** 48px height, 12px rounded borders in `#E2E8F0`, `#F8FAFC` background when unfocused, transitioning to `#1E6B56` border upon focus.
- **Toggle Controls:** Pill track in `#E2E8F0` with `#FFFFFF` knob; `#1E6B56` active track.

### Navigation Dock
- **Bottom Navigation Bar:** Floating dock design with 24px radius, pure white surface with ambient elevation shadow, housing 5 core icon actions: Home, Explore, Post (+), Saved, and Profile. Active state is highlighted with `#1E6B56`.

### Stepper & Progress Indicators
- **Adoption Flow Stepper:** Circular numbered steps connected by horizontal progress tracks. Completed steps adopt `#1E6B56` with white numeral, active step shows ring highlight, and upcoming steps remain muted `#E2E8F0`.