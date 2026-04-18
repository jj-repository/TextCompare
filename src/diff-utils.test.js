/**
 * Tests for diff-utils.js
 * Run with: npm test
 */

const assert = require('assert');

const {
    computeLCSOptimized,
    computeLCSFullMatrix,
    computeMyersDiff,
    backtrackLCS,
    diffChars,
    escapeHtml,
    debounce,
    LCS_FULL_MATRIX_MAX_CELLS
} = require('./diff-utils');

// Simple test framework (Node.js built-in test runner compatible)
let passed = 0;
let failed = 0;

function describe(name, fn) {
    console.log(`\n${name}`);
    fn();
}

const asyncTests = [];

function it(name, fn) {
    if (fn.length > 0) {
        // Async test with done callback — defer it
        asyncTests.push({ name, fn });
        return;
    }
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
        failed++;
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toEqual(expected) {
            assert.deepStrictEqual(actual, expected);
        },
        toHaveLength(expected) {
            if (actual.length !== expected) {
                throw new Error(`Expected length ${expected}, got ${actual.length}`);
            }
        },
        toBeGreaterThan(expected) {
            if (!(actual > expected)) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toContain(expected) {
            if (!actual.includes(expected)) {
                throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected ${actual} to be truthy`);
            }
        }
    };
}

// Tests

describe('escapeHtml', () => {
    it('should escape < and >', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersand', () => {
        expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape quotes', () => {
        expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    it('should handle empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('should handle non-string input', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle plain text', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });
});

describe('computeLCSFullMatrix', () => {
    it('should find LCS for identical strings', () => {
        const a = ['a', 'b', 'c'];
        const b = ['a', 'b', 'c'];
        const result = computeLCSFullMatrix(a, b);
        expect(result.type).toBe('full');
        expect(result.m).toBe(3);
        expect(result.n).toBe(3);
        expect(result.dp[3][3]).toBe(3); // LCS length is 3
    });

    it('should find LCS for different strings', () => {
        const a = ['a', 'b', 'c', 'd'];
        const b = ['a', 'c', 'd'];
        const result = computeLCSFullMatrix(a, b);
        expect(result.dp[4][3]).toBe(3); // LCS is "acd"
    });

    it('should handle empty arrays', () => {
        const result = computeLCSFullMatrix([], []);
        expect(result.dp[0][0]).toBe(0);
    });

    it('should handle one empty array', () => {
        const result = computeLCSFullMatrix(['a', 'b'], []);
        expect(result.dp[2][0]).toBe(0);
    });
});

describe('backtrackLCS', () => {
    it('should backtrack full matrix correctly', () => {
        const a = ['a', 'b', 'c'];
        const b = ['a', 'b', 'c'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(3);
        expect(matches[0]).toEqual({ type: 'equal', left: 0, right: 0 });
    });

    it('should handle partial matches', () => {
        const a = ['a', 'x', 'b'];
        const b = ['a', 'y', 'b'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(2); // 'a' and 'b' match
    });

    it('should handle no matches', () => {
        const a = ['x', 'y'];
        const b = ['a', 'b'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(0);
    });

    it('should handle bounds errors gracefully', () => {
        const invalidResult = { type: 'full', dp: [], m: 10, n: 10 };
        const matches = backtrackLCS(invalidResult, [], []);
        expect(matches).toHaveLength(0);
    });
});

describe('computeLCSOptimized', () => {
    it('should use full matrix for small inputs', () => {
        const a = ['a', 'b'];
        const b = ['a', 'b'];
        const result = computeLCSOptimized(a, b);
        expect(result.type).toBe('full');
    });

    it('should produce correct results', () => {
        const a = ['line1', 'line2', 'line3'];
        const b = ['line1', 'line3'];
        const lcsResult = computeLCSOptimized(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(2);
    });
});

describe('debounce', () => {
    it('should return a function', () => {
        const debounced = debounce(() => {}, 100);
        expect(typeof debounced).toBe('function');
    });

    it('should delay execution and coalesce rapid calls', (done) => {
        let callCount = 0;
        let lastArg = null;
        const debounced = debounce((arg) => {
            callCount++;
            lastArg = arg;
        }, 50);

        debounced('a');
        debounced('b');
        debounced('c');

        // Should not have been called yet
        expect(callCount).toBe(0);

        setTimeout(() => {
            expect(callCount).toBe(1);
            expect(lastArg).toBe('c');
            done();
        }, 100);
    });
});

describe('computeLCSOptimized - routing', () => {
    it('should use Myers path for large inputs', () => {
        // Need m*n > 1,000,000 to trigger Myers path
        const a = new Array(1001).fill(null).map((_, i) => String(i));
        const b = new Array(1001).fill(null).map((_, i) => String(i));
        const result = computeLCSOptimized(a, b);
        expect(result.type).toBe('myers');

        // Verify correctness: identical arrays should fully match
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(1001);
    });
});

describe('computeMyersDiff', () => {
    it('should find matches for identical sequences', () => {
        const a = ['a', 'b', 'c'];
        const b = ['a', 'b', 'c'];
        const result = computeMyersDiff(a, b);
        expect(result.type).toBe('myers');
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(3);
    });

    it('should find matches with insertions', () => {
        const a = ['a', 'c'];
        const b = ['a', 'b', 'c'];
        const result = computeMyersDiff(a, b);
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(2);
        expect(matches[0]).toEqual({ type: 'equal', left: 0, right: 0 });
        expect(matches[1]).toEqual({ type: 'equal', left: 1, right: 2 });
    });

    it('should find matches with deletions', () => {
        const a = ['a', 'b', 'c'];
        const b = ['a', 'c'];
        const result = computeMyersDiff(a, b);
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(2);
        expect(matches[0]).toEqual({ type: 'equal', left: 0, right: 0 });
        expect(matches[1]).toEqual({ type: 'equal', left: 2, right: 1 });
    });

    it('should handle completely different sequences', () => {
        const a = ['x', 'y'];
        const b = ['a', 'b'];
        const result = computeMyersDiff(a, b);
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(0);
    });

    it('should handle empty sequences', () => {
        const result = computeMyersDiff([], []);
        expect(result.type).toBe('myers');
        expect(backtrackLCS(result, [], [])).toHaveLength(0);
    });

    it('should handle one empty sequence', () => {
        const result = computeMyersDiff(['a', 'b'], []);
        const matches = backtrackLCS(result, ['a', 'b'], []);
        expect(matches).toHaveLength(0);
    });

    it('should handle repeated elements', () => {
        const a = ['a', 'a', 'b'];
        const b = ['a', 'b', 'a'];
        const result = computeMyersDiff(a, b);
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(2);
    });

    it('should work correctly for large identical sequences', () => {
        const a = new Array(2000).fill(null).map((_, i) => String(i));
        const b = a.slice();
        const result = computeMyersDiff(a, b);
        expect(result.type).toBe('myers');
        const matches = backtrackLCS(result, a, b);
        expect(matches).toHaveLength(2000);
    });

    it('should work correctly for large sequences with few diffs', () => {
        const a = new Array(2000).fill(null).map((_, i) => String(i));
        const b = a.slice();
        b[500] = 'CHANGED';
        b.splice(1000, 0, 'INSERTED');
        const result = computeMyersDiff(a, b);
        const matches = backtrackLCS(result, a, b);
        // Should find 1999 matches (all except the changed line)
        expect(matches).toHaveLength(1999);
    });
});

describe('LCS end-to-end correctness', () => {
    it('should handle insertions at beginning', () => {
        const a = ['b', 'c'];
        const b = ['a', 'b', 'c'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(2);
        expect(matches[0]).toEqual({ type: 'equal', left: 0, right: 1 });
        expect(matches[1]).toEqual({ type: 'equal', left: 1, right: 2 });
    });

    it('should handle deletions at end', () => {
        const a = ['a', 'b', 'c'];
        const b = ['a', 'b'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(2);
    });

    it('should handle repeated elements', () => {
        const a = ['a', 'a', 'b'];
        const b = ['a', 'b', 'a'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(2); // LCS is 'a','b' or 'a','a'
    });

    it('should handle single element vs empty', () => {
        const a = ['a'];
        const b = [];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(0);
    });

    it('should handle empty vs single element', () => {
        const a = [];
        const b = ['a'];
        const lcsResult = computeLCSFullMatrix(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(0);
    });
});

describe('diffChars', () => {
    it('should return identical escaped text for equal strings', () => {
        const result = diffChars('hello', 'hello');
        expect(result.left).toBe('hello');
        expect(result.right).toBe('hello');
    });

    it('should escape HTML in equal strings', () => {
        const result = diffChars('<b>', '<b>');
        expect(result.left).toBe('&lt;b&gt;');
    });

    it('should highlight added text', () => {
        const result = diffChars('', 'added');
        expect(result.right).toContain('diff-char-changed');
        expect(result.right).toContain('added');
    });

    it('should highlight removed text', () => {
        const result = diffChars('removed', '');
        expect(result.left).toContain('diff-char-changed');
        expect(result.left).toContain('removed');
    });

    it('should highlight character-level differences', () => {
        const result = diffChars('abc', 'axc');
        expect(result.left).toContain('diff-char-changed');
        expect(result.right).toContain('diff-char-changed');
        // Common chars a and c should not be wrapped in spans
        expect(result.left).toContain('a');
        expect(result.left).toContain('c');
    });

    it('should mark every position as changed when all chars differ', () => {
        const long = 'x'.repeat(300);
        const result = diffChars(long, long.replace(/x/g, 'y'));
        expect(result.left).toContain('diff-char-changed');
        expect(result.right).toContain('diff-char-changed');
    });

    it('should compare positionally, not by subsequence (12 3 6 vs 13 4 5223 6)', () => {
        // Left's "3" is at index 3; right[3] is "4". Positional says these differ —
        // LCS would have matched left's "3" to right's later "3".
        const result = diffChars('12 3    6', '13 4 5223 6');
        // Left index 3 is '3' and must be wrapped as changed (paired with right's '4')
        expect(result.left).toContain('<span class="diff-char-changed">');
        // Right overhang (past left.length) uses diff-char-missing placeholder on left
        expect(result.left).toContain('diff-char-missing');
    });

    it('should mark tail overhang on the longer side', () => {
        const result = diffChars('abc', 'abcdef');
        // Shared "abc" not wrapped
        expect(result.left.startsWith('abc')).toBe(true);
        // Right's "def" wrapped as changed
        expect(result.right).toContain('def');
        expect(result.right).toContain('diff-char-changed');
        // Left side gets a missing placeholder of width 3
        expect(result.left).toContain('min-width:3ch');
    });
});

// Run async tests, then report
function runAsyncTests(index) {
    if (index >= asyncTests.length) {
        console.log('\n' + '='.repeat(50));
        console.log(`Tests: ${passed} passed, ${failed} failed`);
        console.log('='.repeat(50));
        if (failed > 0) process.exit(1);
        return;
    }
    const { name, fn } = asyncTests[index];
    try {
        fn(() => {
            console.log(`  ✓ ${name}`);
            passed++;
            runAsyncTests(index + 1);
        });
    } catch (e) {
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
        failed++;
        runAsyncTests(index + 1);
    }
}

if (asyncTests.length > 0) {
    console.log('\nAsync tests');
    runAsyncTests(0);
} else {
    console.log('\n' + '='.repeat(50));
    console.log(`Tests: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    if (failed > 0) process.exit(1);
}
