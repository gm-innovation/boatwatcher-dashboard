

# Fix: CI failing — `dist/index.html not found after build`

## Root Cause

The workflow step **"Validate dist/index.html asset paths"** runs before any build step. The Vite build (`npm run build:desktop`) only happens inside the later steps "Build and publish Desktop release" or "Build Desktop (dry-run)", which are electron-builder commands that call `npm run build:desktop` internally.

The validation step was added to catch white-screen issues but was placed too early in the pipeline.

## Fix

Add an explicit Vite build step **before** the validation step in `.github/workflows/desktop-release.yml`:

```yaml
      # ── Build web assets ──
      - name: Build web assets (Vite)
        run: npm run build:desktop

      # ── Validate dist assets (prevent white-screen releases) ──
      - name: Validate dist/index.html asset paths
        shell: bash
        run: |
          INDEX="dist/index.html"
          ...
```

This ensures `dist/` exists when the validation runs. The later electron-builder steps will reuse the existing `dist/` directory (or rebuild if needed — either way, no conflict).

## File Changed

- `.github/workflows/desktop-release.yml` — insert one step before validation

