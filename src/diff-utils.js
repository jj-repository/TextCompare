/**
 * Diff utility functions for TextCompare
 * Extracted from index.html for testability
 */

const LCS_FULL_MATRIX_THRESHOLD = 1000;

/**
 * Compute LCS (Longest Common Subsequence) with automatic optimization selection
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result object
 */
function computeLCSOptimized(a, b) {
    const m = a.length, n = b.length;

    // For small inputs, use full matrix (simpler backtracking)
    if (m * n <= LCS_FULL_MATRIX_THRESHOLD * LCS_FULL_MATRIX_THRESHOLD) {
        return computeLCSFullMatrix(a, b);
    }

    // For large inputs, use Myers' diff algorithm (O(ND) time, much faster when few diffs)
    return computeMyersDiff(a, b);
}

/**
 * Myers' O(ND) diff algorithm — optimal for sequences with few differences.
 * Time: O((m+n)*D) where D = number of edits. Space: O(D*(m+n)) for trace.
 * Falls back to empty sentinel if D exceeds safety limit.
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result with pre-computed matches
 */
function computeMyersDiff(a, b) {
    const m = a.length, n = b.length;
    const max = m + n;

    if (max === 0) return { type: 'myers', matches: [], m: 0, n: 0 };

    // Safety limit: bail if edit distance is too large (prevents unbounded memory)
    const maxD = Math.min(max, 10000);

    const size = 2 * max + 1;
    const vBuf = new Int32Array(size);
    vBuf[max + 1] = 0;

    // Store traces for backtracking (one v snapshot per edit step)
    const traces = [];

    for (let d = 0; d <= maxD; d++) {
        traces.push(vBuf.slice());

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
 * Backtrack Myers trace to extract matching positions
 */
function backtrackMyers(traces, a, b, numEdits, max) {
    const matches = [];
    let x = a.length, y = b.length;

    for (let d = numEdits; d > 0; d--) {
        // traces[d] = v state before processing d = state after d-1
        const v = traces[d];
        const k = x - y;

        let prevK;
        if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
            prevK = k + 1;
        } else {
            prevK = k - 1;
        }

        const prevX = v[max + prevK];
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
 * Compute LCS using space-optimized algorithm (O(n) space)
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result with decisions array
 */
function computeLCSSpaceOptimized(a, b) {
    const m = a.length, n = b.length;

    if (m * n > 50_000_000) { // ~50MB limit for Uint8Array
        // Fall back: return empty match set so all lines show as changed
        return { type: 'empty', m: 0, n: 0 };
    }

    // Use two rows instead of full matrix
    let prev = new Array(n + 1).fill(0);
    let curr = new Array(n + 1).fill(0);

    // Store decisions for backtracking (bit-packed for memory efficiency)
    // 0 = came from left, 1 = came from top, 2 = diagonal match
    const decisions = new Array(m);

    for (let i = 1; i <= m; i++) {
        decisions[i - 1] = new Uint8Array(n);
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                curr[j] = prev[j - 1] + 1;
                decisions[i - 1][j - 1] = 2; // diagonal
            } else if (prev[j] > curr[j - 1]) {
                curr[j] = prev[j];
                decisions[i - 1][j - 1] = 1; // top
            } else {
                curr[j] = curr[j - 1];
                decisions[i - 1][j - 1] = 0; // left
            }
        }
        [prev, curr] = [curr, prev];
    }

    return { type: 'optimized', decisions, m, n };
}

/**
 * Backtrack LCS result to get matching positions
 * @param {Object} lcsResult - Result from computeLCS functions
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Array} Array of matching positions
 */
function backtrackLCS(lcsResult, a, b) {
    // Myers results already contain pre-computed matches
    if (lcsResult.type === 'myers') {
        return lcsResult.matches;
    }

    const result = [];
    let i = lcsResult.m, j = lcsResult.n;

    // Bounds validation to prevent index errors
    if (i < 0 || j < 0 || i > a.length || j > b.length) {
        console.error('LCS backtracking bounds error: invalid indices');
        return result;
    }

    if (lcsResult.type === 'full') {
        const dp = lcsResult.dp;
        // Validate dp matrix exists and has correct dimensions
        if (!dp || dp.length <= i) {
            console.error('LCS backtracking error: invalid dp matrix');
            return result;
        }
        while (i > 0 && j > 0) {
            // Validate row exists before accessing
            if (!dp[i] || !dp[i - 1]) {
                console.error('LCS backtracking error: missing dp row');
                break;
            }
            if (a[i - 1] === b[j - 1]) {
                result.push({ type: 'equal', left: i - 1, right: j - 1 });
                i--; j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
    } else {
        const decisions = lcsResult.decisions;
        // Validate decisions array exists
        if (!decisions || decisions.length < i) {
            console.error('LCS backtracking error: invalid decisions array');
            return result;
        }
        while (i > 0 && j > 0) {
            // Validate indices before accessing
            if (!decisions[i - 1] || j - 1 >= decisions[i - 1].length) {
                console.error('LCS backtracking error: invalid decision index');
                break;
            }
            const decision = decisions[i - 1][j - 1];
            if (decision === 2) { // diagonal match
                result.push({ type: 'equal', left: i - 1, right: j - 1 });
                i--; j--;
            } else if (decision === 1) { // top
                i--;
            } else { // left
                j--;
            }
        }
    }

    result.reverse();
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
 * Compare two version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * Character-level diff between two strings, returning HTML with change highlighting.
 * Skips LCS for lines > 2000 combined chars to avoid O(k^2) per line.
 */
function diffChars(left, right) {
    if (left === right) return { left: escapeHtml(left), right: escapeHtml(right) };
    if (!left && right) return { left: '<span class="diff-char-missing"></span>', right: '<span class="diff-char-changed">' + escapeHtml(right) + '</span>' };
    if (left && !right) return { left: '<span class="diff-char-changed">' + escapeHtml(left) + '</span>', right: '<span class="diff-char-missing"></span>' };

    if (left.length + right.length > 2000) {
        return {
            left: '<span class="diff-char-changed">' + escapeHtml(left) + '</span>',
            right: '<span class="diff-char-changed">' + escapeHtml(right) + '</span>'
        };
    }

    const leftChars = left.split('');
    const rightChars = right.split('');
    const lcsResult = computeLCSOptimized(leftChars, rightChars);
    const lcs = backtrackLCS(lcsResult, leftChars, rightChars);

    let leftHtml = '', rightHtml = '';
    let li = 0, ri = 0, lcsIdx = 0;

    while (li < left.length || ri < right.length) {
        if (lcsIdx < lcs.length && li === lcs[lcsIdx].left && ri === lcs[lcsIdx].right) {
            leftHtml += escapeHtml(left[li]);
            rightHtml += escapeHtml(right[ri]);
            li++; ri++; lcsIdx++;
        } else {
            let leftChunk = '', rightChunk = '';
            while (li < left.length && (lcsIdx >= lcs.length || li < lcs[lcsIdx].left)) {
                leftChunk += left[li++];
            }
            while (ri < right.length && (lcsIdx >= lcs.length || ri < lcs[lcsIdx].right)) {
                rightChunk += right[ri++];
            }
            if (leftChunk) {
                leftHtml += '<span class="diff-char-changed">' + escapeHtml(leftChunk) + '</span>';
            } else if (rightChunk) {
                leftHtml += '<span class="diff-char-missing"></span>';
            }
            if (rightChunk) {
                rightHtml += '<span class="diff-char-changed">' + escapeHtml(rightChunk) + '</span>';
            } else if (leftChunk) {
                rightHtml += '<span class="diff-char-missing"></span>';
            }
        }
    }

    return { left: leftHtml, right: rightHtml };
}

// Export for Node.js (tests) or expose globally for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeLCSOptimized,
        computeLCSFullMatrix,
        computeLCSSpaceOptimized,
        computeMyersDiff,
        backtrackLCS,
        diffChars,
        escapeHtml,
        debounce,
        compareVersions,
        LCS_FULL_MATRIX_THRESHOLD
    };
} else if (typeof window !== 'undefined') {
    window.DiffUtils = {
        computeLCSOptimized,
        computeLCSFullMatrix,
        computeLCSSpaceOptimized,
        computeMyersDiff,
        backtrackLCS,
        diffChars,
        escapeHtml,
        debounce,
        compareVersions,
        LCS_FULL_MATRIX_THRESHOLD
    };
}
