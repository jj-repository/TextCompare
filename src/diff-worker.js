/**
 * Web Worker for off-main-thread diff computation.
 * Receives left/right text + options, returns diff results for rendering.
 */

// Import shared diff utilities
if (typeof importScripts === 'function') {
    importScripts('./diff-utils.js');
}

if (typeof self !== 'undefined' && !self.DiffUtils) {
    throw new Error('Failed to load diff-utils.js — DiffUtils not available');
}

const { computeLCSOptimized, backtrackLCS, escapeHtml, diffChars } = self.DiffUtils;

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

        // Line-level LCS
        const lcsResult = computeLCSOptimized(normalizedLeft, normalizedRight);
        const matches = backtrackLCS(lcsResult, normalizedLeft, normalizedRight);

        // Build diff output
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
            for (let k = 0; k < pairs; k++) {
                emitModified(lStart + k, rStart + k);
            }
            for (let k = pairs; k < lEnd - lStart; k++) {
                emitRemoved(lStart + k);
            }
            for (let k = pairs; k < rEnd - rStart; k++) {
                emitAdded(rStart + k);
            }
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
