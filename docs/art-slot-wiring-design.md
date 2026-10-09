# Art Slot Wiring Design: Quida Patient UI

Summary of decisions made during the art slot wiring grill session on Friday Oct 9, 2026.

## Summary
Hand drawn artwork by Yari provides the human warmth and cultural resonance for Quida. The art slots in the UI render transparent PNGs from `public/art/`, gracefully falling back to line icons or null when files are not present. This document locks the slot locations, alt text policy, and authoritative contract.

## Terms
- **slot**: A named location in the UI where a hand-drawn PNG from `public/art/` is displayed with a fallback line icon.
- **decorative art**: Artwork placed beside accompanying descriptive text that conveys identical meaning, receiving `alt=""` to prevent duplicate announcements on screen readers.

## Decisions

### 1. Cerca Drawing Visibility (q1 -> Option C)
- **Decision**: Enabled on all patient-facing surfaces, disabled on caregiver screens.
- **Locations**:
  - Patient Fence Notice
  - Patient Medicinas view
  - Patient Card view
  - Patient Home footer
  - Role Chooser page (`/`)
- **Rationale**: The drawing humanizes the safety boundary for Doña Carmen. Caregiver screens remain compact and text-focused.

### 2. Alt Text Accessibility Policy (q2 -> Option A)
- **Decision**: Empty alt (`alt=""`) when adjacent text provides the same label. Meaningful Spanish descriptions when the image stands alone or carries distinct context.
- **Rationale**: Prevents screen readers from announcing words twice (e.g. "Hablar Hablar") on voice-first, high-accessibility surfaces.

### 3. Canonical Art Contract (q3 -> Option C)
- **Decision**: `qwida-warroom/ui/ASSETS.md` and `components/ui/Art.tsx` are the authoritative source of truth.
- **Action**: Section 3.2 in `qwida-warroom/ui/DESIGN.md` now carries a direct note pointing to `ASSETS.md`.

## Asset Delivery
- PNG assets exported from Procreate (ink `#1B1A17`, transparent background) are dropped into `public/art/`.
