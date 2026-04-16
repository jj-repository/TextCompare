# Review Queue — TextCompare Audit v2.5.0

Generated: 2026-04-05
Last updated: 2026-04-16 — all remaining items resolved.

## Summary
**Total Issues**: 32 | High: 7 | Medium: 10 | Low: 15
**Fixed**: 31 (7 high, 9 medium, 15 low) | **Dismissed**: 1 (M6) | **Remaining**: 0

---

## HIGH (7)

### H1. No cryptographic verification of update binaries
- **Agent**: security-expert
- **File**: electron-main.js:208-246
- **Category**: security
- **Description**: Downloaded exe/AppImage replaced with zero checksum/signature verification. Compromised GitHub account = arbitrary code execution.
- **Fix**: Download checksums-sha256.txt from release, compute SHA-256, compare before replacing. Implemented in fetchExpectedSha256() and computeFileSha256(); throws on mismatch.
- **Effort**: medium
- **Status**: [x] fixed (commit 6dbdc7b)

### H2. Build workflow ships without running tests
- **Agent**: devops-reviewer
- **File**: .github/workflows/build-executables.yml:39
- **Category**: ci/cd
- **Description**: Tag push triggers build+release without `npm test`.
- **Fix**: Add `- run: npm test` before build steps.
- **Effort**: small
- **Status**: [x] fixed

### H3. Worker terminated on every exitCompareMode — race condition
- **Agent**: code-quality-reviewer
- **File**: src/app.js:549-553
- **Category**: correctness
- **Description**: Rapid compare→exit→compare causes stale worker messages and spawn overhead.
- **Fix**: Keep worker alive. compareGeneration counter passed in postMessage and echoed back; onmessage discards mismatched generations. exitCompareMode bumps generation instead of terminating.
- **Effort**: medium
- **Status**: [x] fixed

### H4. Worker silent import failure
- **Agent**: code-quality-reviewer
- **File**: src/diff-worker.js:11
- **Category**: error-handling
- **Description**: If `importScripts` fails, all functions are `undefined`. Error is cryptic.
- **Fix**: Add: `if (!self.DiffUtils) throw new Error('Failed to load diff-utils.js');`
- **Effort**: small
- **Status**: [x] fixed

### H5. Virtual scroll only listens to leftDiff
- **Agent**: code-quality-reviewer
- **File**: src/app.js:484-488
- **Category**: correctness
- **Description**: `renderVisibleLines` only fires from leftDiff. Scrolling rightDiff lags 1-2 frames.
- **Fix**: Register handler on rightDiff too. Clean up both in exitCompareMode.
- **Effort**: small
- **Status**: [x] fixed

### H6. Ctrl+S saves right panel regardless of focus
- **Agent**: code-quality-reviewer
- **File**: src/app.js:670-676
- **Category**: ux
- **Description**: Ctrl+S always saves right. Users expect it to save the focused panel.
- **Fix**: Use `lastFocusedTextarea` to determine side.
- **Effort**: small
- **Status**: [x] fixed

### H7. Myers trace storage — O(D) full-array copies (GB-scale)
- **Agent**: performance-engineer
- **File**: src/diff-utils.js:44-48
- **Category**: performance
- **Description**: Each edit step copies entire vBuf. 50K-line files with 500 edits = 400MB.
- **Fix**: Windowed trace — each step stores only v[max-d-1..max+d+1] (size 2d+3). Total ~D^2 ints. Safety limit lowered from 10k to 3k edits. 500 edits now ≈1MB vs prior 200MB. Backtracker translates via stored offset.
- **Effort**: medium
- **Status**: [x] fixed

---

## MEDIUM (10)

### M1. isUpdateInProgress stuck on dialog dismiss
- **File**: electron-main.js:179-363
- **Fix**: Add `.catch()` handlers resetting the flag.
- **Effort**: small | **Status**: [x] fixed

### M2. Line numbers cache stale after exitCompareMode
- **File**: src/app.js:556-557
- **Fix**: Reset `prevLineCount` before calling `updateLineNumbers`.
- **Effort**: small | **Status**: [x] fixed

### M3. highlightCurrentDiff linear scan through all HTML parts
- **File**: src/app.js:579-585
- **Fix**: Build `diffIndexToRow` lookup map in `applyDiffResults`.
- **Effort**: small | **Status**: [x] fixed

### M4. Window state lost on maximize-close-reopen-unmaximize
- **File**: electron-main.js:529-550
- **Fix**: Use `getNormalBounds()` always.
- **Effort**: small | **Status**: [x] fixed

### M5. scrollRafId shared between left and right panels
- **File**: src/app.js:67-73
- **Fix**: Use separate IDs per side with explicit scroll-lock.
- **Effort**: small | **Status**: [x] fixed

### M6. Bat trampoline PID substring match unreliable
- **File**: electron-main.js:322-326
- **Description**: False positive — `tasklist /FI "PID eq N"` already does exact filtering.
- **Effort**: N/A | **Status**: [x] dismissed

### M7. diffChars 2000-char threshold too generous
- **File**: src/diff-utils.js:297
- **Fix**: Lowered to 500.
- **Effort**: small | **Status**: [x] fixed

### M8. Deploy workflow fragile hardcoded file list
- **File**: .github/workflows/deploy.yml:33-36
- **Fix**: Use glob `cp src/*.js` and add smoke test.
- **Effort**: small | **Status**: [x] fixed

### M9. Dependabot auto-merge lacks CI gate
- **File**: .github/workflows/dependabot-auto-merge.yml
- **Fix**: Workflow removed entirely. Auto-merge could execute malicious postinstall scripts during `npm install` before CI tests run; user chose manual review for all Dependabot PRs over trying to harden the auto-merge flow.
- **Effort**: small | **Status**: [x] fixed (removed workflow)

### M10. Dead code: computeLCSSpaceOptimized never called
- **File**: src/diff-utils.js:154-188
- **Fix**: Remove function and its tests.
- **Effort**: small | **Status**: [x] fixed

---

## LOW (15)

### L1. Dead code: compareVersions in diff-utils.js
- **File**: src/diff-utils.js:275 | **Fix**: Removed | **Status**: [x] fixed

### L2. Unused imports in app.js
- **File**: src/app.js:5 | **Fix**: Removed unused destructures | **Status**: [x] fixed

### L3. CSP allows style-src 'unsafe-inline'
- **File**: index.html:29 | **Fix**: All CSS extracted to src/styles.css. 13 inline style= attributes converted to named classes (toolbar-spacer, toolbar--compact, download-bar, modal-body, modal-row, modal-footer, modal-avatar, modal-byline, modal-version, settings-row-small, download-filename, download-bar-wrap, download-percent). CSP tightened to `style-src 'self'`. | **Status**: [x] fixed

### L4. img-src allows file: scheme
- **File**: index.html:29 | **Fix**: Removed `file:` | **Status**: [x] fixed

### L5. DevTools not fully blocked in production
- **File**: electron-main.js:585 | **Fix**: Added devtools-opened listener that immediately calls closeDevTools() in addition to the existing F12/Ctrl+Shift+I block. | **Status**: [x] fixed

### L6. shell.openExternal accepts any HTTPS URL
- **File**: electron-main.js:697 | **Fix**: isAllowedExternalUrl() parses URL and enforces allowlist [github.com, jj-repository.github.io] (exact or subdomain). IPC handler gates shell.openExternal through this check. | **Status**: [x] fixed

### L7. Deploy triggers on master branch too
- **File**: .github/workflows/deploy.yml:5 | **Fix**: Removed master | **Status**: [x] fixed

### L8. Build workflow missing top-level permissions: {}
- **File**: .github/workflows/build-executables.yml | **Fix**: Added | **Status**: [x] fixed

### L9. CLAUDE.md version out of sync
- **File**: CLAUDE.md | **Fix**: Updated to v2.05 | **Status**: [x] fixed

### L10. Minimap creates 2*N DOM elements
- **File**: src/app.js:624-639 | **Fix**: Bucketed rendering — minimap height divided into MINIMAP_BUCKET_PX-wide buckets; each bucket emits at most one marker per diff type (added/removed/modified). Click targets first diff in bucket. DOM size bounded regardless of diff count. | **Status**: [x] fixed

### L11. updateLineNumbers iterates chars manually
- **File**: src/app.js:236 | **Fix**: Uses split('\n').length now | **Status**: [x] fixed

### L12. LCS threshold naming confusing
- **File**: src/diff-utils.js:6,18 | **Fix**: Renamed to LCS_FULL_MATRIX_MAX_CELLS | **Status**: [x] fixed

### L13. setAutoUpdate uses invoke for fire-and-forget
- **File**: preload.js:22 | **Fix**: preload switched to ipcRenderer.send; electron-main switched to ipcMain.on. No return value expected or used on renderer side. | **Status**: [x] fixed

### L14. No linting in CI
- **File**: .github/workflows/ci.yml | **Fix**: Added `npm run lint` step; eslint.config.js with 9.x flat config; rules no-undef/no-var/prefer-const/eqeqeq + per-file env (node for main/preload, browser for app, worker for diff-worker). 0 errors, 7 warnings on current tree. | **Status**: [x] fixed

### L15. No artifact attestation for release binaries
- **File**: .github/workflows/build-executables.yml | **Fix**: actions/attest-build-provenance@v2 added to release job with id-token:write + attestations:write permissions; attests all .AppImage and .exe artifacts. | **Status**: [x] fixed

---

## Test Coverage Gaps

- **diffChars()** — 0 direct tests for the most user-visible function
- **diff-worker.js** — no integration test for worker message flow
- **app.js** — 684 lines, 0 tests
- **electron-main.js** — versionNewer() untested
