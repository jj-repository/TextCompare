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

    // For large inputs, use space-optimized version
    return computeLCSSpaceOptimized(a, b);
}

/**
 * Compute LCS using full matrix (O(m*n) space)
 * @param {Array} a - First sequence
 * @param {Array} b - Second sequence
 * @returns {Object} LCS result with dp matrix
 */
function computeLCSFullMatrix(a, b) {
    const m = a.length, n = b.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

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
                result.unshift({ type: 'equal', left: i - 1, right: j - 1 });
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
                result.unshift({ type: 'equal', left: i - 1, right: j - 1 });
                i--; j--;
            } else if (decision === 1) { // top
                i--;
            } else { // left
                j--;
            }
        }
    }

    return result;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    // Simple implementation without DOM
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

// Export for testing (CommonJS for Node.js compatibility)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        computeLCSOptimized,
        computeLCSFullMatrix,
        computeLCSSpaceOptimized,
        backtrackLCS,
        escapeHtml,
        debounce,
        compareVersions,
        LCS_FULL_MATRIX_THRESHOLD
    };
}
