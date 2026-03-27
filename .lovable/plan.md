

# Fix: CI failing at "Validate Desktop asar contents"

## Root Cause

The asar validation step (line 115) runs **before** the electron-builder step (line 133) that actually creates the asar. When triggered by a tag (`v1.3.11`), the `if` condition is true, `find` returns nothing, but since the step expects the asar to exist on tag builds, it errors out.

## Fix

Move the "Validate Desktop asar contents" step to **after** the Desktop build steps (after line 139). It should run only on tag pushes, which is already the case.

### Updated step order:
```
Build web assets (Vite)
Validate dist/index.html asset paths
Build and publish Desktop release        ← creates the asar
Build Desktop (dry-run, no publish)      ← or this one
Validate Desktop asar contents           ← MOVED HERE (after build)
Build Local Server ...
```

## File Changed

- `.github/workflows/desktop-release.yml` — move the asar validation block (lines 114-130) to after line 139

