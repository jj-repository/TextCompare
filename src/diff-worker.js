// Self-contained Web Worker for off-main-thread diff computation.
// All diff functions are inlined here to avoid importScripts() which fails
// when the app is packaged inside an Electron asar archive.

const LCS_FULL_MATRIX_MAX_CELLS = 1_000_000;

function computeLCSOptimized(a, b) {
    const m = a.length, n = b.length;
    if (m * n <= LCS_FULL_MATRIX_MAX_CELLS) {
        return computeLCSFullMatrix(a, b);
    }
    return computeMyersDiff(a, b);
}

function computeMyersDiff(a, b) {
    const m = a.length, n = b.length;
    const max = m + n;

    if (max === 0) return { type: 'myers', matches: [], m: 0, n: 0 };

    const maxD = Math.min(max, 3000);
    const size = 2 * max + 1;
    const vBuf = new Int32Array(size);
    vBuf[max + 1] = 0;
    const traces = [];

    for (let d = 0; d <= maxD; d++) {
        const offset = max - d - 1;
        traces.push(vBuf.slice(offset, max + d + 2));

        for (let k = -d; k <= d; k += 2) {
            let x;
            if (k === -d || (k !== d && vBuf[max + k - 1] < vBuf[max + k + 1])) {
                x = vBuf[max + k + 1];
            } else {
                x = vBuf[max + k - 1] + 1;
            }

            let y = x - k;
            while (x < m && y < n && a[x] === b[y]) { x++; y++; }
            vBuf[max + k] = x;

            if (x >= m && y >= n) {
                return backtrackMyers(traces, a, b, d, max);
            }
        }
    }

    return { type: 'empty', m: 0, n: 0 };
}

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

        while (x > prevX && y > prevY) { x--; y--; matches.push({ type: 'equal', left: x, right: y }); }
        x = prevX;
        y = prevY;
    }

    while (x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
        x--; y--;
        matches.push({ type: 'equal', left: x, right: y });
    }

    matches.reverse();
    return { type: 'myers', matches, m: a.length, n: b.length };
}

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

function backtrackLCS(lcsResult, a, b) {
    if (lcsResult.type === 'myers') return lcsResult.matches;

    const result = [];
    let i = lcsResult.m, j = lcsResult.n;
    if (i < 0 || j < 0 || i > a.length || j > b.length) return result;

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

const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
const HTML_ESCAPE_RE = /[&<>"']/g;

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(HTML_ESCAPE_RE, ch => HTML_ESCAPE_MAP[ch]);
}

function diffChars(left, right) {
    if (left === right) return { left: escapeHtml(left), right: escapeHtml(right) };
    if (!left && right) return { left: '<span class="diff-char-missing"></span>', right: '<span class="diff-char-changed">' + escapeHtml(right) + '</span>' };
    if (left && !right) return { left: '<span class="diff-char-changed">' + escapeHtml(left) + '</span>', right: '<span class="diff-char-missing"></span>' };

    if (left.length + right.length > 500) {
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
            while (li < left.length && (lcsIdx >= lcs.length || li < lcs[lcsIdx].left)) leftChunk += left[li++];
            while (ri < right.length && (lcsIdx >= lcs.length || ri < lcs[lcsIdx].right)) rightChunk += right[ri++];
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

self.onmessage = function(e) {
    const { generation, leftText, rightText, ignoreWhitespace, ignoreCase } = e.data;

    try {
        const leftLines = leftText.split('\n');
        const rightLines = rightText.split('\n');

        const normalize = (line) => {
            let s = line;
            if (ignoreWhitespace) s = s.replace(/\s+/g, ' ').trim();
            if (ignoreCase) s = s.toLowerCase();
            return s;
        };

        const normalizedLeft = leftLines.map(normalize);
        const normalizedRight = rightLines.map(normalize);

        const lcsResult = computeLCSOptimized(normalizedLeft, normalizedRight);
        const matches = backtrackLCS(lcsResult, normalizedLeft, normalizedRight);

        const differences = [];
        const leftHtmlParts = [];
        const rightHtmlParts = [];
        const leftLineNumParts = [];
        const rightLineNumParts = [];

        const emitEqual = (li, ri) => {
            leftHtmlParts.push(`<div class="diff-line">${escapeHtml(leftLines[li]) || '&nbsp;'}</div>`);
            rightHtmlParts.push(`<div class="diff-line">${escapeHtml(rightLines[ri]) || '&nbsp;'}</div>`);
            leftLineNumParts.push(li + 1);
            rightLineNumParts.push(ri + 1);
        };
        const emitRemoved = (li) => {
            const diffIdx = differences.length;
            differences.push({ leftLine: li + 1, type: 'removed' });
            leftHtmlParts.push(`<div class="diff-line" data-diff="${diffIdx}"><span class="diff-char-changed">${escapeHtml(leftLines[li]) || '&nbsp;'}</span></div>`);
            rightHtmlParts.push(`<div class="diff-line" data-diff="${diffIdx}">&nbsp;</div>`);
            leftLineNumParts.push(li + 1);
            rightLineNumParts.push('-');
        };
        const emitAdded = (ri) => {
            const diffIdx = differences.length;
            differences.push({ rightLine: ri + 1, type: 'added' });
            leftHtmlParts.push(`<div class="diff-line" data-diff="${diffIdx}">&nbsp;</div>`);
            rightHtmlParts.push(`<div class="diff-line" data-diff="${diffIdx}"><span class="diff-char-changed">${escapeHtml(rightLines[ri]) || '&nbsp;'}</span></div>`);
            leftLineNumParts.push('-');
            rightLineNumParts.push(ri + 1);
        };
        const emitModified = (li, ri) => {
            const diffIdx = differences.length;
            differences.push({ leftLine: li + 1, rightLine: ri + 1, type: 'modified' });
            const charDiff = diffChars(leftLines[li], rightLines[ri]);
            leftHtmlParts.push(`<div class="diff-line" data-diff="${diffIdx}">${charDiff.left || '&nbsp;'}</div>`);
            rightHtmlParts.push(`<div class="diff-line" data-diff="${diffIdx}">${charDiff.right || '&nbsp;'}</div>`);
            leftLineNumParts.push(li + 1);
            rightLineNumParts.push(ri + 1);
        };

        const emitGap = (lStart, lEnd, rStart, rEnd) => {
            const pairs = Math.min(lEnd - lStart, rEnd - rStart);
            for (let k = 0; k < pairs; k++) emitModified(lStart + k, rStart + k);
            for (let k = pairs; k < lEnd - lStart; k++) emitRemoved(lStart + k);
            for (let k = pairs; k < rEnd - rStart; k++) emitAdded(rStart + k);
        };

        let li = 0, ri = 0;
        for (let m = 0; m < matches.length; m++) {
            const match = matches[m];
            emitGap(li, match.left, ri, match.right);
            emitEqual(match.left, match.right);
            li = match.left + 1;
            ri = match.right + 1;
        }
        emitGap(li, leftLines.length, ri, rightLines.length);

        self.postMessage({
            type: 'result',
            generation,
            differences,
            leftHtmlParts,
            rightHtmlParts,
            leftLineNumParts,
            rightLineNumParts
        });
    } catch (error) {
        self.postMessage({ type: 'error', generation, message: error.message });
    }
};
