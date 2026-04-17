(function() {
    'use strict';

    // Import shared utilities from diff-utils.js
    const { escapeHtml } = window.DiffUtils;

    // Web Worker for off-main-thread diff computation.
    // Kept alive across compare sessions; stale results are discarded via generation counter.
    let diffWorker = null;
    let compareGeneration = 0;
    function getDiffWorker() {
        if (!diffWorker) {
            diffWorker = new Worker('src/diff-worker.js');
        }
        return diffWorker;
    }

    // Constants
    const BYTES_PER_MB = 1024 * 1024;
    const MAX_FILE_SIZE_MB = 10;
    const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * BYTES_PER_MB;

    // State
    let differences = [];
    let currentDiffIndex = -1;
    let isCompareMode = false;
    let isComparing = false;
    let lastFocusedTextarea = null;
    let leftFilePath = null;
    let rightFilePath = null;

    // DOM Elements
    const leftText = document.getElementById('leftText');
    const rightText = document.getElementById('rightText');
    const leftDiff = document.getElementById('leftDiff');
    const rightDiff = document.getElementById('rightDiff');
    const leftLineNumbers = document.getElementById('leftLineNumbers');
    const rightLineNumbers = document.getElementById('rightLineNumbers');
    const leftFileInput = document.getElementById('leftFileInput');
    const rightFileInput = document.getElementById('rightFileInput');
    const diffCounter = document.getElementById('diffCounter');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const statusCenter = document.getElementById('statusCenter');
    const statusLeft = document.getElementById('statusLeft');
    const statusRight = document.getElementById('statusRight');
    const leftFilename = document.getElementById('leftFilename');
    const rightFilename = document.getElementById('rightFilename');
    const leftMinimap = document.getElementById('leftMinimap');
    const rightMinimap = document.getElementById('rightMinimap');
    const ignoreWhitespaceCheckbox = document.getElementById('ignoreWhitespace');
    const ignoreCaseCheckbox = document.getElementById('ignoreCase');
    const showLineNumbersCheckbox = document.getElementById('showLineNumbers');

    // Initialize
    function init() {
        // Update line numbers on input
        leftText.addEventListener('input', () => {
            updateLineNumbers('left');
            updateStatus();
            if (isCompareMode) exitCompareMode();
        });
        rightText.addEventListener('input', () => {
            updateLineNumbers('right');
            updateStatus();
            if (isCompareMode) exitCompareMode();
        });

        // Sync scroll (using requestAnimationFrame for smooth frame-aligned sync)
        let leftScrollRafId = null;
        let rightScrollRafId = null;
        let leftDiffScrollRafId = null;
        let rightDiffScrollRafId = null;
        leftText.addEventListener('scroll', () => {
            if (!leftScrollRafId) leftScrollRafId = requestAnimationFrame(() => { syncScroll('left'); leftScrollRafId = null; });
        });
        rightText.addEventListener('scroll', () => {
            if (!rightScrollRafId) rightScrollRafId = requestAnimationFrame(() => { syncScroll('right'); rightScrollRafId = null; });
        });
        leftDiff.addEventListener('scroll', () => {
            if (!leftDiffScrollRafId) leftDiffScrollRafId = requestAnimationFrame(() => { syncScrollDiff('left'); leftDiffScrollRafId = null; });
        });
        rightDiff.addEventListener('scroll', () => {
            if (!rightDiffScrollRafId) rightDiffScrollRafId = requestAnimationFrame(() => { syncScrollDiff('right'); rightDiffScrollRafId = null; });
        });

        // Double-click on diff view to exit compare mode and edit
        leftDiff.addEventListener('dblclick', () => {
            if (isCompareMode) {
                exitCompareMode();
                leftText.focus();
            }
        });
        rightDiff.addEventListener('dblclick', () => {
            if (isCompareMode) {
                exitCompareMode();
                rightText.focus();
            }
        });

        // File input handlers
        leftFileInput.addEventListener('change', (e) => handleFileLoad(e, 'left'));
        rightFileInput.addEventListener('change', (e) => handleFileLoad(e, 'right'));

        // Drag-and-drop file support
        function setupDragDrop(element, side) {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                element.classList.add('drag-over');
            });
            element.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                element.classList.remove('drag-over');
            });
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                element.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleFileDrop(files[0], side);
                }
            });
        }
        setupDragDrop(leftText, 'left');
        setupDragDrop(rightText, 'right');

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // Line numbers toggle
        showLineNumbersCheckbox.addEventListener('change', toggleLineNumbers);

        // Toolbar button handlers
        document.getElementById('btnCompare').addEventListener('click', compare);
        document.getElementById('btnPrev').addEventListener('click', prevDiff);
        document.getElementById('btnNext').addEventListener('click', nextDiff);
        document.getElementById('btnSwap').addEventListener('click', swapPanels);
        document.getElementById('btnClearAll').addEventListener('click', () => {
            if (confirm('Clear all text on both sides?')) {
                clearAll();
            }
        });
        // Track last focused textarea for undo and save
        lastFocusedTextarea = leftText;
        leftText.addEventListener('focus', () => { lastFocusedTextarea = leftText; });
        rightText.addEventListener('focus', () => { lastFocusedTextarea = rightText; });
        document.getElementById('btnUndo').addEventListener('click', () => {
            lastFocusedTextarea.focus();
            document.execCommand('undo');
        });

        // Download progress from main process
        if (window.electron && window.electron.onDownloadProgress) {
            window.electron.onDownloadProgress((data) => {
                const overlay = document.getElementById('downloadOverlay');
                if (!data) {
                    overlay.classList.remove('active');
                    return;
                }
                overlay.classList.add('active');
                document.getElementById('downloadBar').style.width = data.percent + '%';
                document.getElementById('downloadPercent').textContent = 'Downloading... ' + data.percent + '%';
                document.getElementById('downloadFileName').textContent = data.fileName;
            });
        }

        // Settings modal
        const settingsModal = document.getElementById('settingsModal');
        document.getElementById('btnSettings').addEventListener('click', () => {
            settingsModal.classList.add('active');
        });
        document.getElementById('btnCloseSettings').addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.classList.remove('active');
        });
        document.getElementById('btnSettingsCheckUpdates').addEventListener('click', () => {
            if (window.electron && window.electron.checkForUpdates) {
                window.electron.checkForUpdates();
            }
        });
        document.getElementById('btnSettingsReadme').addEventListener('click', () => {
            if (window.electron && window.electron.openExternal) {
                window.electron.openExternal('https://github.com/jj-repository/TextCompare#readme');
            } else {
                window.open('https://github.com/jj-repository/TextCompare#readme', '_blank');
            }
        });
        document.getElementById('btnSettingsReportBug').addEventListener('click', () => {
            if (window.electron && window.electron.openExternal) {
                window.electron.openExternal('https://github.com/jj-repository/TextCompare/issues/new?template=bug_report.yml');
            } else {
                window.open('https://github.com/jj-repository/TextCompare/issues/new?template=bug_report.yml', '_blank');
            }
        });
        // Auto-update checkbox synced with electron settings
        const autoUpdateCheckbox = document.getElementById('settingsAutoUpdate');
        if (window.electron && window.electron.getSettings) {
            window.electron.getSettings().then(settings => {
                autoUpdateCheckbox.checked = settings.autoCheckUpdates;
                if (settings.version) {
                    document.getElementById('settingsVersion').textContent = 'v' + settings.version;
                }
            }).catch(err => console.error('Failed to load settings:', err));
        }
        autoUpdateCheckbox.addEventListener('change', () => {
            if (window.electron && window.electron.setAutoUpdate) {
                window.electron.setAutoUpdate(autoUpdateCheckbox.checked);
            }
        });

        // Left panel button handlers
        document.getElementById('btnLoadLeft').addEventListener('click', () => loadFile('left'));
        document.getElementById('btnSaveLeft').addEventListener('click', () => saveFile('left'));
        document.getElementById('btnClearLeft').addEventListener('click', () => clearPanel('left'));

        // Right panel button handlers
        document.getElementById('btnLoadRight').addEventListener('click', () => loadFile('right'));
        document.getElementById('btnSaveRight').addEventListener('click', () => saveFile('right'));
        document.getElementById('btnClearRight').addEventListener('click', () => clearPanel('right'));

        updateStatus();
    }

    // Toggle line numbers visibility
    function toggleLineNumbers() {
        const show = showLineNumbersCheckbox.checked;
        leftLineNumbers.classList.toggle('hidden', !show);
        rightLineNumbers.classList.toggle('hidden', !show);
    }

    // Line numbers (cached to avoid rebuilding on every keystroke)
    let prevLineCount = { left: 0, right: 0 };
    function updateLineNumbers(side) {
        const text = side === 'left' ? leftText : rightText;
        const lineNums = side === 'left' ? leftLineNumbers : rightLineNumbers;
        const count = text.value.split('\n').length;
        if (count === prevLineCount[side]) return;
        prevLineCount[side] = count;
        lineNums.textContent = Array.from({length: count}, (_, i) => i + 1).join('\n');
    }

    // Scroll sync
    function syncScroll(source) {
        if (isCompareMode) return;
        const sourceEl = source === 'left' ? leftText : rightText;
        const targetEl = source === 'left' ? rightText : leftText;
        const sourceLines = source === 'left' ? leftLineNumbers : rightLineNumbers;
        const targetLines = source === 'left' ? rightLineNumbers : leftLineNumbers;

        targetEl.scrollTop = sourceEl.scrollTop;
        sourceLines.scrollTop = sourceEl.scrollTop;
        targetLines.scrollTop = sourceEl.scrollTop;
    }

    function syncScrollDiff(source) {
        if (!isCompareMode) return;
        const sourceEl = source === 'left' ? leftDiff : rightDiff;
        const targetEl = source === 'left' ? rightDiff : leftDiff;
        const sourceLines = source === 'left' ? leftLineNumbers : rightLineNumbers;
        const targetLines = source === 'left' ? rightLineNumbers : leftLineNumbers;

        targetEl.scrollTop = sourceEl.scrollTop;
        sourceLines.scrollTop = sourceEl.scrollTop;
        targetLines.scrollTop = sourceEl.scrollTop;
    }

    // File loading
    function loadFile(side) {
        const input = side === 'left' ? leftFileInput : rightFileInput;
        input.click();
    }

    // Shared file reading logic
    function readFileIntoPanel(file, side, resetInput) {
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            const sizeMB = (file.size / BYTES_PER_MB).toFixed(2);
            const proceed = confirm(
                `Warning: File size is ${sizeMB}MB, which exceeds the recommended limit of ${MAX_FILE_SIZE_MB}MB.\n\n` +
                `Large files may cause the browser to freeze during comparison.\n\n` +
                `Do you want to continue?`
            );
            if (!proceed) {
                if (resetInput) resetInput();
                return;
            }
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            if (side === 'left') {
                leftText.value = text;
                leftFilename.textContent = file.name;
                leftFilePath = file.path || null;
            } else {
                rightText.value = text;
                rightFilename.textContent = file.name;
                rightFilePath = file.path || null;
            }
            updateLineNumbers(side);
            updateStatus();
            if (isCompareMode) exitCompareMode();
            statusCenter.textContent = `Loaded: ${file.name}`;
            if (resetInput) resetInput();
        };
        reader.onerror = () => {
            const errorDetail = (reader.error && (reader.error.message || reader.error.name)) || 'Unknown error';
            const errorMsg = `Failed to load file: ${file.name}`;
            alert(`${errorMsg}\n\nError: ${errorDetail}\n\nThe file may be corrupted, too large, or have an unsupported encoding.`);
            statusCenter.textContent = errorMsg;
            console.error('FileReader error:', reader.error);
            if (resetInput) resetInput();
        };
        reader.onabort = () => {
            statusCenter.textContent = `Load cancelled: ${file.name}`;
            if (resetInput) resetInput();
        };
        reader.readAsText(file);
    }

    function handleFileLoad(event, side) {
        const file = event.target.files[0];
        readFileIntoPanel(file, side, () => { event.target.value = ''; });
    }

    function handleFileDrop(file, side) {
        readFileIntoPanel(file, side);
    }

    // Save file
    async function saveFile(side) {
        const text = side === 'left' ? leftText.value : rightText.value;
        const filenameEl = side === 'left' ? leftFilename : rightFilename;
        const filePath = side === 'left' ? leftFilePath : rightFilePath;
        const defaultName = filenameEl.textContent === 'No file loaded' ? '' : filenameEl.textContent;

        if (!window.electron?.saveFile) return;

        const result = await window.electron.saveFile(filePath, defaultName, text);
        if (result.success) {
            if (side === 'left') leftFilePath = result.filePath;
            else rightFilePath = result.filePath;
            const name = result.filePath.split(/[/\\]/).pop();
            filenameEl.textContent = name;
            statusCenter.textContent = `Saved: ${name}`;
        } else if (!result.canceled) {
            statusCenter.textContent = `Save failed: ${result.error}`;
        }
    }

    // Clear functions
    function clearPanel(side) {
        if (side === 'left') {
            leftText.value = '';
            leftFilename.textContent = 'No file loaded';
            leftFilePath = null;
        } else {
            rightText.value = '';
            rightFilename.textContent = 'No file loaded';
            rightFilePath = null;
        }
        updateLineNumbers(side);
        updateStatus();
        if (isCompareMode) exitCompareMode();
    }

    function clearAll() {
        clearPanel('left');
        clearPanel('right');
    }

    // Swap panels
    function swapPanels() {
        const tempText = leftText.value;
        const tempFilenameText = leftFilename.textContent;
        const tempPath = leftFilePath;

        leftText.value = rightText.value;
        leftFilename.textContent = rightFilename.textContent;
        leftFilePath = rightFilePath;

        rightText.value = tempText;
        rightFilename.textContent = tempFilenameText;
        rightFilePath = tempPath;

        updateLineNumbers('left');
        updateLineNumbers('right');
        updateStatus();
        if (isCompareMode) compare();
    }

    // Status bar
    function updateStatus() {
        const leftLines = leftText.value ? leftText.value.split('\n').length : 0;
        const leftChars = leftText.value.length;
        const rightLines = rightText.value ? rightText.value.split('\n').length : 0;
        const rightChars = rightText.value.length;

        statusLeft.textContent = `Left: ${leftLines} lines, ${leftChars} characters`;
        statusRight.textContent = `Right: ${rightLines} lines, ${rightChars} characters`;
    }

    // Virtual scrolling state
    let LINE_HEIGHT = 20; // px per diff line, measured from rendered element on first use
    const BUFFER_LINES = 30; // extra lines above/below viewport
    let vScrollData = null;
    let vScrollRenderedRange = { start: -1, end: -1 };
    let diffIndexToRow = null; // O(1) lookup: diff index → row index

    function measureLineHeight() {
        const probe = document.createElement('div');
        probe.className = 'diff-line';
        probe.textContent = 'X';
        leftDiff.appendChild(probe);
        const h = probe.offsetHeight;
        leftDiff.removeChild(probe);
        if (h > 0) LINE_HEIGHT = h;
    }

    function renderVisibleLines(scrollTop) {
        if (!vScrollData) return;
        const { leftParts, rightParts, leftNums, rightNums, totalLines } = vScrollData;
        const viewportHeight = leftDiff.clientHeight;
        const firstVisible = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - BUFFER_LINES);
        const lastVisible = Math.min(totalLines, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + BUFFER_LINES);

        if (firstVisible === vScrollRenderedRange.start && lastVisible === vScrollRenderedRange.end) return;
        vScrollRenderedRange = { start: firstVisible, end: lastVisible };

        const leftChunk = leftParts.slice(firstVisible, lastVisible).join('');
        const rightChunk = rightParts.slice(firstVisible, lastVisible).join('');
        const leftNumChunk = leftNums.slice(firstVisible, lastVisible).join('\n');
        const rightNumChunk = rightNums.slice(firstVisible, lastVisible).join('\n');

        const topPad = firstVisible * LINE_HEIGHT;
        const bottomPad = (totalLines - lastVisible) * LINE_HEIGHT;

        leftDiff.innerHTML = `<div style="height:${topPad}px"></div>${leftChunk}<div style="height:${bottomPad}px"></div>`;
        rightDiff.innerHTML = `<div style="height:${topPad}px"></div>${rightChunk}<div style="height:${bottomPad}px"></div>`;
        leftLineNumbers.innerHTML = `<div style="height:${topPad}px"></div>${leftNumChunk}<div style="height:${bottomPad}px"></div>`;
        rightLineNumbers.innerHTML = `<div style="height:${topPad}px"></div>${rightNumChunk}<div style="height:${bottomPad}px"></div>`;

        if (currentDiffIndex >= 0) {
            leftDiff.querySelectorAll(`[data-diff="${currentDiffIndex}"]`).forEach(el => el.classList.add('current'));
            rightDiff.querySelectorAll(`[data-diff="${currentDiffIndex}"]`).forEach(el => el.classList.add('current'));
        }
    }

    // Apply diff results to the DOM with virtual scrolling
    function applyDiffResults(result) {
        differences = result.differences;
        currentDiffIndex = -1;
        measureLineHeight();
        const totalLines = result.leftHtmlParts.length;

        vScrollData = {
            leftParts: result.leftHtmlParts,
            rightParts: result.rightHtmlParts,
            leftNums: result.leftLineNumParts,
            rightNums: result.rightLineNumParts,
            totalLines
        };
        vScrollRenderedRange = { start: -1, end: -1 };

        // Build O(1) diff-index-to-row lookup
        diffIndexToRow = {};
        for (let i = 0; i < result.leftHtmlParts.length; i++) {
            const match = result.leftHtmlParts[i].match(/data-diff="(\d+)"/);
            if (match) diffIndexToRow[match[1]] = i;
        }

        leftText.classList.add('hidden');
        rightText.classList.add('hidden');
        leftDiff.classList.remove('hidden');
        rightDiff.classList.remove('hidden');

        renderVisibleLines(0);

        const onDiffScroll = () => {
            renderVisibleLines(leftDiff.scrollTop);
        };
        leftDiff._vScrollHandler = onDiffScroll;
        leftDiff.addEventListener('scroll', onDiffScroll);
        rightDiff._vScrollHandler = onDiffScroll;
        rightDiff.addEventListener('scroll', onDiffScroll);

        isCompareMode = true;
        updateDiffCounter();
        updateMinimap();

        statusCenter.textContent = `Found ${differences.length} difference${differences.length !== 1 ? 's' : ''}`;

        if (differences.length > 0) {
            currentDiffIndex = 0;
            highlightCurrentDiff();
        }
    }

    // Main compare function
    function compare() {
        if (isComparing) return;
        isComparing = true;
        loadingOverlay.classList.add('active');

        const gen = ++compareGeneration;
        const worker = getDiffWorker();
        worker.onmessage = function(e) {
            // Discard results from superseded compare runs
            if (e.data.generation !== compareGeneration) return;
            try {
                if (e.data.type === 'result') {
                    applyDiffResults(e.data);
                } else if (e.data.type === 'error') {
                    console.error('Worker error:', e.data.message);
                    alert('An error occurred during comparison. The files may be too large or contain invalid content.');
                    statusCenter.textContent = 'Comparison failed';
                }
            } finally {
                loadingOverlay.classList.remove('active');
                isComparing = false;
            }
        };
        worker.onerror = function(err) {
            console.error('Worker fatal error:', err);
            loadingOverlay.classList.remove('active');
            isComparing = false;
            statusCenter.textContent = 'Comparison failed';
            // Drop the broken worker so the next compare spawns a fresh one
            if (diffWorker) { try { diffWorker.terminate(); } catch (_) {} diffWorker = null; }
        };

        worker.postMessage({
            generation: gen,
            leftText: leftText.value,
            rightText: rightText.value,
            ignoreWhitespace: ignoreWhitespaceCheckbox.checked,
            ignoreCase: ignoreCaseCheckbox.checked
        });
    }

    function exitCompareMode() {
        isCompareMode = false;
        leftText.classList.remove('hidden');
        rightText.classList.remove('hidden');
        leftDiff.classList.add('hidden');
        rightDiff.classList.add('hidden');

        if (leftDiff._vScrollHandler) {
            leftDiff.removeEventListener('scroll', leftDiff._vScrollHandler);
            leftDiff._vScrollHandler = null;
        }
        if (rightDiff._vScrollHandler) {
            rightDiff.removeEventListener('scroll', rightDiff._vScrollHandler);
            rightDiff._vScrollHandler = null;
        }
        // Bump generation so any in-flight worker result gets discarded.
        // Worker stays alive — avoids spawn overhead on rapid compare/exit cycles.
        compareGeneration++;
        vScrollData = null;
        vScrollRenderedRange = { start: -1, end: -1 };
        diffIndexToRow = null;

        // Reset cache so line numbers rebuild after virtual scroll HTML
        prevLineCount.left = 0;
        prevLineCount.right = 0;
        updateLineNumbers('left');
        updateLineNumbers('right');

        differences = [];
        currentDiffIndex = -1;
        updateDiffCounter();
        clearMinimap();

        statusCenter.textContent = 'Ready';
    }

    // Navigation
    function updateDiffCounter() {
        const current = currentDiffIndex >= 0 ? currentDiffIndex + 1 : 0;
        diffCounter.textContent = `${current} / ${differences.length}`;
        btnPrev.disabled = differences.length === 0 || currentDiffIndex <= 0;
        btnNext.disabled = differences.length === 0 || currentDiffIndex >= differences.length - 1;
    }

    function highlightCurrentDiff() {
        if (currentDiffIndex < 0 || currentDiffIndex >= differences.length) return;

        if (vScrollData && diffIndexToRow) {
            const targetRow = diffIndexToRow[currentDiffIndex];
            if (targetRow !== undefined) {
                const targetScroll = Math.max(0, (targetRow * LINE_HEIGHT) - (leftDiff.clientHeight / 2));
                leftDiff.scrollTop = targetScroll;
                renderVisibleLines(targetScroll);
            }
        }

        document.querySelectorAll('.diff-line.current').forEach(el => el.classList.remove('current'));
        document.querySelectorAll(`[data-diff="${currentDiffIndex}"]`).forEach(el => el.classList.add('current'));

        updateDiffCounter();
    }

    function prevDiff() {
        if (currentDiffIndex > 0) {
            currentDiffIndex--;
            highlightCurrentDiff();
        }
    }

    function nextDiff() {
        if (currentDiffIndex < differences.length - 1) {
            currentDiffIndex++;
            highlightCurrentDiff();
        }
    }

    // Minimap — bucketed rendering keeps DOM size bounded regardless of diff count.
    // Each bucket renders at most one marker per type; click targets the first diff in the bucket.
    const MINIMAP_BUCKET_PX = 4;
    function updateMinimap() {
        leftMinimap.textContent = '';
        rightMinimap.textContent = '';

        const totalLines = vScrollData ? vScrollData.totalLines : 0;
        if (totalLines === 0 || differences.length === 0) return;

        const minimapHeight = leftMinimap.clientHeight || 400;
        const bucketCount = Math.max(1, Math.floor(minimapHeight / MINIMAP_BUCKET_PX));

        // bucket -> { type -> firstDiffIdx }. Preserves first-hit index per (bucket, type).
        const buckets = new Map();
        for (let idx = 0; idx < differences.length; idx++) {
            const diff = differences[idx];
            const lineNum = diff.leftLine || diff.rightLine || 1;
            const bucketIdx = Math.min(bucketCount - 1,
                Math.floor(((lineNum - 1) / totalLines) * bucketCount));
            let byType = buckets.get(bucketIdx);
            if (!byType) { byType = {}; buckets.set(bucketIdx, byType); }
            if (byType[diff.type] === undefined) byType[diff.type] = idx;
        }

        const leftFrag = document.createDocumentFragment();
        const rightFrag = document.createDocumentFragment();

        for (const [bucketIdx, byType] of buckets) {
            const position = (bucketIdx / bucketCount) * 100;
            for (const type in byType) {
                const firstIdx = byType[type];
                const createMarker = () => {
                    const marker = document.createElement('div');
                    marker.className = `minimap-marker ${type}`;
                    marker.style.top = `${position}%`;
                    marker.dataset.idx = firstIdx;
                    return marker;
                };
                leftFrag.appendChild(createMarker());
                rightFrag.appendChild(createMarker());
            }
        }

        leftMinimap.appendChild(leftFrag);
        rightMinimap.appendChild(rightFrag);

        const minimapClick = (e) => {
            const marker = e.target.closest('.minimap-marker');
            if (marker && marker.dataset.idx !== undefined) {
                currentDiffIndex = parseInt(marker.dataset.idx, 10);
                highlightCurrentDiff();
            }
        };
        leftMinimap.onclick = minimapClick;
        rightMinimap.onclick = minimapClick;
    }

    function clearMinimap() {
        leftMinimap.replaceChildren();
        rightMinimap.replaceChildren();
    }

    // Keyboard shortcuts
    function handleKeyboard(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            compare();
        } else if (e.ctrlKey && e.key === 'ArrowUp') {
            e.preventDefault();
            prevDiff();
        } else if (e.ctrlKey && e.key === 'ArrowDown') {
            e.preventDefault();
            nextDiff();
        } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveFile(lastFocusedTextarea === leftText ? 'left' : 'right');
        } else if (e.key === 'Escape') {
            document.getElementById('settingsModal').classList.remove('active');
            if (isCompareMode) exitCompareMode();
        }
    }

    // Initialize on load
    init();
})();
