# Smarta avatar assets

**Current setup:** the avatar uses `avatar_base.png` (single portrait) with a
voice-reactive pulse during speech — `AVATAR_MODE = 'image'` in
`frontend/src/components/smarta/avatar.ts`.

For **true mouth lip-sync** (mouth visibly opening/closing with the voice), add two
more cropped mouth frames and switch to PNG mode. Drop these files here:

```
public/smarta/avatar_base.png   # head + shoulders, mouth area left empty/neutral
public/smarta/mouth_closed.png  # mouth — closed  (same canvas size, transparent bg)
public/smarta/mouth_open.png    # mouth — open    (same canvas size, transparent bg)
```

Recommendations:
- Square canvas (e.g. 512×512), transparent background (PNG-24).
- `mouth_*` images must align exactly over `avatar_base` (same size/position), so
  swapping them looks like the mouth opening/closing.

## Enabling PNG mode

In `frontend/src/components/smarta/avatar.ts` set:

```ts
const AVATAR_MODE: 'svg' | 'png' = 'png';
```

The lip-sync engine drives `setMouthOpen(0..1)`; in PNG mode it swaps
`mouth_closed.png` ⇄ `mouth_open.png` at a threshold. For smoother animation later
you can add more mouth frames / visemes or a Live2D model — the chat, TTS and
lip-sync code stays unchanged (it only calls the avatar's `setMouthOpen`).
