# Decisions & Standards

## Design Decisions
| Decision | Rationale |
|----------|-----------|
| Single index.html | No frontend build step; simple distribution |
| Direct update download | Portable exe/AppImage with progress bar |
| Minimal deps | Only Electron; no runtime bloat |
| VS Code theme | Familiar to devs; good diff contrast |
| Positional diff (v2.3.0) | Text stays in place; only changed chars highlighted |

## Completed Optimizations
DnD file loading, DnD visual feedback, unused var cleanup, window state persistence, LCS optimized (push+reverse vs O(n²) unshift), direct downloads with progress+5min timeout, HTTPS redirect validation, ipcRenderer leak fix, debounced window saves, settings modal, click-to-edit diff, undo+Clear All, filename sanitization, concurrent update guard, unhandled rejection handler ✓

Version bumps default to **+0.0.1** unless told otherwise. Each component 0–9; rollover on overflow (0.0.9 → 0.1.0).
