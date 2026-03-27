# Security

```javascript
webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
```

- DevTools disabled in production (F12/Ctrl+Shift+I blocked)
- HTTPS validation on all redirects (update checker + downloader)
- URL whitelist on `open-external` (HTTPS only)
- 1MB response size limit on API calls
- ipcRenderer listener cleanup (no memory leaks)
- No network calls except update check/download
- Download filename sanitization (path traversal prevention)

## Review (2026-03-15 — Production Ready)
Context isolation, sandbox, no nodeIntegration, DevTools blocked, HTTPS redirect validation, URL whitelist, 1MB limit, listener cleanup, 10s timeout ✓
26/26 tests, no unused vars, DnD, window state, debounced saves ✓
