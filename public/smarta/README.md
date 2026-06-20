# Smarta avatar assets

**Current setup — frame-swap lip-sync (`AVATAR_MODE = 'frames'`):**
the avatar plays a 2-frame mouth animation driven by the voice loudness while
Smarta speaks.

```
public/smarta/avatar_base.png   # CLOSED mouth  (idle + quiet moments)
public/smarta/frame_open.png    # OPEN mouth    (shown on louder syllables)
```

These were picked from the 11 source portraits in the (git-ignored) `SMARTA/`
working folder, classified by mouth state:

| Source frames | Mouth | Use |
|---|---|---|
| 1, 3, 5, 6, 9, 10, 11 | closed | idle / closed |
| **4, 8** | **open** | talking |
| 2, 7 | closed + wink | expression only |

`avatar_base.png` = frame **1**, `frame_open.png` = frame **8** — chosen because
they share the same framing (longer hair, frontal), so swapping them looks clean
with no head "jump". The portraits are expression variants, **not** a phoneme
viseme set, so lip-sync is **amplitude-based** (loud → open, quiet → closed),
not per-sound mouth shapes.

## Tuning (if needed after testing)

In `frontend/src/components/smarta/avatar.ts`:
- `OPEN_AT` / `CLOSE_AT` — loudness thresholds (lower = mouth opens more eagerly).
- `MIN_HOLD_MS` — minimum time per frame (raise to calm flicker, lower for snappier).

In `frontend/src/styles/smarta.css` (`.smarta-avatar--frames .smarta-frame`):
- `object-position: center 36%` — vertical framing of the face in the circle.
  Raise the % if the mouth is cropped out; lower it to show more of the mouth.

## Future upgrades (architecture already supports them)
- Add more open frames (e.g. half-open) for a 3–4 level mouth ladder.
- A true viseme set (ah/oh/ee/mm…) + phoneme timing → swap `setMouthOpen` for a
  `setViseme()` mapping; chat/TTS code stays unchanged.
- Cropped `mouth_closed.png` + `mouth_open.png` overlays → `AVATAR_MODE = 'png'`.
- Live2D model.

> Tip: the frames are ~1.5 MB each (full portraits). For faster loading, resize
> them to ~256×256 px — the avatar only renders at ~60 px.
