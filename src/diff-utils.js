/**
 * Diff utility functions for TextCompare
 * Extracted from index.html for testability
 */

const LCS_FULL_MATRIX_MAX_CELLS = 1_000_000;

/**
 * Compute LCS (Longest Common Subsequence) with automatic optimization selection
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result object
 */
function computeLCSOptimized(a, b) {
    const m = a.length, n = b.length;

    // For small inputs, use full matrix (simpler backtracking)
    if (m * n <= LCS_FULL_MATRIX_MAX_CELLS) {
        return computeLCSFullMatrix(a, b);
    }

    // For large inputs, use Myers' diff algorithm (O(ND) time, much faster when few diffs)
    return computeMyersDiff(a, b);
}

/**
 * Myers' O(ND) diff algorithm — optimal for sequences with few differences.
 * Time: O((m+n)*D) where D = number of edits.
 * Space: O(D^2) — each trace stores only the relevant window [max-d-1, max+d+1]
 *        of the v array (width 2d+3) instead of the full m+n array.
 * Falls back to empty sentinel if D exceeds safety limit.
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result with pre-computed matches
 */
function computeMyersDiff(a, b) {
    const m = a.length, n = b.length;
    const max = m + n;

    if (max === 0) return { type: 'myers', matches: [], m: 0, n: 0 };

    // Safety limit: bail if edit distance is too large (prevents unbounded memory).
    // With delta-trace storage total memory is ~D^2 ints, so 3000 → ~36MB.
    const maxD = Math.min(max, 3000);

    const size = 2 * max + 1;
    const vBuf = new Int32Array(size);
    vBuf[max + 1] = 0;

    // Store windowed trace snapshots — only the [max-d-1, max+d+1] slice the
    // backtracker actually reads. Each entry is the slice of v at the start
    // of step d; backtrack translates global index via the stored offset.
    const traces = [];

    for (let d = 0; d <= maxD; d++) {
        const offset = max - d - 1;
        traces.push(vBuf.slice(offset, max + d + 2));

        for (let k = -d; k <= d; k += 2) {
            let x;
            if (k === -d || (k !== d && vBuf[max + k - 1] < vBuf[max + k + 1])) {
                x = vBuf[max + k + 1]; // move down (insert)
            } else {
                x = vBuf[max + k - 1] + 1; // move right (delete)
            }

            let y = x - k;

            // Follow diagonals (equal elements)
            while (x < m && y < n && a[x] === b[y]) {
                x++;
                y++;
            }

            vBuf[max + k] = x;

            if (x >= m && y >= n) {
                // Backtrack to find matching positions
                return backtrackMyers(traces, a, b, d, max);
            }
        }
    }

    // D exceeded safety limit — fall back to empty matches (all lines shown as changed)
    return { type: 'empty', m: 0, n: 0 };
}

/**
 * Backtrack Myers trace to extract matching positions.
 * Each traces[d] is the windowed v-slice for step d with offset (max - d - 1).
 */
function backtrackMyers(traces, a, b, numEdits, max) {
    const matches = [];
    let x = a.length, y = b.length;

    for (let d = numEdits; d > 0; d--) {
        const slice = traces[d];
        const offset = max - d - 1;
        const vAt = (idx) => slice[idx - offset];
        const k = x - y;

        let prevK;
        if (k === -d || (k !== d && vAt(max + k - 1) < vAt(max + k + 1))) {
            prevK = k + 1;
        } else {
            prevK = k - 1;
        }

        const prevX = vAt(max + prevK);
        const prevY = prevX - prevK;

        // Collect diagonal matches (backwards)
        while (x > prevX && y > prevY) {
            x--;
            y--;
            matches.push({ type: 'equal', left: x, right: y });
        }

        x = prevX;
        y = prevY;
    }

    // Remaining diagonal at the start
    while (x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
        x--;
        y--;
        matches.push({ type: 'equal', left: x, right: y });
    }

    matches.reverse();
    return { type: 'myers', matches, m: a.length, n: b.length };
}

/**
 * Compute LCS using full matrix (O(m*n) space)
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result with dp matrix
 */
function computeLCSFullMatrix(a, b) {
    const m = a.length, n = b.length;
    const dp = Array(m + 1).fill(null).map(() => new Int32Array(n + 1));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return { type: 'full', dp, m, n };
}

/**
 * Backtrack LCS result to get matching positions
 * @param {Object} lcsResult - Result from computeLCS functions
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Array} Array of matching positions
 */
function backtrackLCS(lcsResult, a, b) {
    if (lcsResult.type === 'myers') {
        return lcsResult.matches;
    }

    const result = [];
    let i = lcsResult.m, j = lcsResult.n;

    if (i < 0 || j < 0 || i > a.length || j > b.length) {
        return result;
    }

    const dp = lcsResult.dp;
    if (!dp || dp.length <= i) return result;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            result.push({ type: 'equal', left: i - 1, right: j - 1 });
            i--; j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    result.reverse();

    // Shift each match as early as possible. The LCS backtracker sometimes picks
    // a later occurrence of a repeated character (e.g. the 2nd space) when an
    // earlier one at the same logical position produces a cleaner visual diff.
    for (let idx = 0; idx < result.length; idx++) {
        const m = result[idx];
        const prevLeft  = idx > 0 ? result[idx - 1].left  : -1;
        const prevRight = idx > 0 ? result[idx - 1].right : -1;
        const nextLeft  = idx < result.length - 1 ? result[idx + 1].left  : a.length;
        const nextRight = idx < result.length - 1 ? result[idx + 1].right : b.length;
        const ch = a[m.left];
        let fl = m.left, fr = m.right;
        outer: for (let l = prevLeft + 1; l <= m.left; l++) {
            if (a[l] !== ch || l >= nextLeft) continue;
            for (let r = prevRight + 1; r <= m.right; r++) {
                if (b[r] !== ch || r >= nextRight) continue;
                fl = l; fr = r;
                break outer;
            }
        }
        if (fl !== m.left || fr !== m.right) result[idx] = { type: 'equal', left: fl, right: fr };
    }

    return result;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
const HTML_ESCAPE_RE = /[&<>"']/g;

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(HTML_ESCAPE_RE, ch => HTML_ESCAPE_MAP[ch]);
}

/**
 * Debounce function to limit rate of function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Positional character-level diff: compares left[i] to right[i] at each index.
 * Tail overhang on the longer side is marked as added/removed. No LCS —
 * characters are NOT realigned; this is literal index-by-index comparison.
 */
function diffChars(left, right) {
    if (left === right) return { left: escapeHtml(left), right: escapeHtml(right) };
    if (!left && right) return { left: `<span class="diff-char-missing" style="min-width:${right.length}ch"></span>`, right: '<span class="diff-char-changed">' + escapeHtml(right) + '</span>' };
    if (left && !right) return { left: '<span class="diff-char-changed">' + escapeHtml(left) + '</span>', right: `<span class="diff-char-missing" style="min-width:${left.length}ch"></span>` };

    const maxLen = Math.max(left.length, right.length);
    let leftHtml = '', rightHtml = '';
    let i = 0;

    while (i < maxLen) {
        const start = i;
        const bothIn = i < left.length && i < right.length;

        if (bothIn && left[i] === right[i]) {
            while (i < left.length && i < right.length && left[i] === right[i]) i++;
            const seg = left.slice(start, i);
            leftHtml += escapeHtml(seg);
            rightHtml += escapeHtml(seg);
        } else if (bothIn) {
            while (i < left.length && i < right.length && left[i] !== right[i]) i++;
            leftHtml  += '<span class="diff-char-changed">' + escapeHtml(left.slice(start, i))  + '</span>';
            rightHtml += '<span class="diff-char-changed">' + escapeHtml(right.slice(start, i)) + '</span>';
        } else if (i < left.length) {
            const seg = left.slice(start);
            i = left.length;
            leftHtml  += '<span class="diff-char-changed">' + escapeHtml(seg) + '</span>';
            rightHtml += `<span class="diff-char-missing" style="min-width:${seg.length}ch"></span>`;
        } else {
            const seg = right.slice(start);
            i = right.length;
            leftHtml  += `<span class="diff-char-missing" style="min-width:${seg.length}ch"></span>`;
            rightHtml += '<span class="diff-char-changed">' + escapeHtml(seg) + '</span>';
        }
    }

    return { left: leftHtml, right: rightHtml };
}

// Export for Node.js (tests) or expose globally for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeLCSOptimized,
        computeLCSFullMatrix,
        computeMyersDiff,
        backtrackLCS,
        diffChars,
        escapeHtml,
        debounce,
        LCS_FULL_MATRIX_MAX_CELLS
    };
} else if (typeof window !== 'undefined') {
    window.DiffUtils = {
        computeLCSOptimized,
        computeLCSFullMatrix,
        computeMyersDiff,
        backtrackLCS,
        diffChars,
        escapeHtml,
        debounce,
        LCS_FULL_MATRIX_MAX_CELLS
    };
}
