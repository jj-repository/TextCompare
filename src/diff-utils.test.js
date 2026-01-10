/**
 * Tests for diff-utils.js
 * Run with: npm test
 */

const {
    computeLCSOptimized,
    computeLCSFullMatrix,
    computeLCSSpaceOptimized,
    backtrackLCS,
    escapeHtml,
    debounce,
    compareVersions
} = require('./diff-utils');

// Simple test framework (Node.js built-in test runner compatible)
let passed = 0;
let failed = 0;

function describe(name, fn) {
    console.log(`\n${name}`);
    fn();
}

function it(name, fn) {
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
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
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

describe('compareVersions', () => {
    it('should return 1 when v1 > v2', () => {
        expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
        expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
        expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    });

    it('should return -1 when v1 < v2', () => {
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should return 0 when versions are equal', () => {
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
        expect(compareVersions('2.1.3', '2.1.3')).toBe(0);
    });

    it('should handle v prefix', () => {
        expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
        expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
    });

    it('should handle different version lengths', () => {
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1.0.1', '1.0')).toBe(1);
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

describe('computeLCSSpaceOptimized', () => {
    it('should return correct type', () => {
        const result = computeLCSSpaceOptimized(['a', 'b'], ['a', 'b']);
        expect(result.type).toBe('optimized');
    });

    it('should have decisions array', () => {
        const result = computeLCSSpaceOptimized(['a', 'b', 'c'], ['a', 'c']);
        expect(result.decisions.length).toBe(3);
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

    it('should backtrack optimized correctly', () => {
        const a = ['a', 'b', 'c'];
        const b = ['a', 'b', 'c'];
        const lcsResult = computeLCSSpaceOptimized(a, b);
        const matches = backtrackLCS(lcsResult, a, b);
        expect(matches).toHaveLength(3);
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
});

// Run and report
console.log('\n' + '='.repeat(50));
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
    process.exit(1);
}
