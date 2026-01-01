# TextCompare

[![Build](https://github.com/jj-repository/TextCompare/actions/workflows/build-executables.yml/badge.svg)](https://github.com/jj-repository/TextCompare/actions/workflows/build-executables.yml)
[![Latest Release](https://img.shields.io/github/v/release/jj-repository/TextCompare)](https://github.com/jj-repository/TextCompare/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/jj-repository/TextCompare/total)](https://github.com/jj-repository/TextCompare/releases)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

A modern, web-based text diff tool with a VS Code-inspired interface for comparing and analyzing differences between two text files.

## Features

### Core Functionality
- **Side-by-side diff view** with color-coded changes
- **Line-level and character-level** difference highlighting
- **Intelligent diff algorithm** using Longest Common Subsequence (LCS)
- **Navigate between differences** with keyboard shortcuts or UI buttons
- **Minimap visualization** for quick navigation through large files
- **Real-time line counting** and character statistics

### Comparison Options
- **Ignore whitespace** - Compare content without whitespace sensitivity
- **Ignore case** - Case-insensitive text comparison
- **Toggle line numbers** - Show/hide line numbers in the editor

### File Operations
- **Load files** from your local system (supports most text formats)
- **Save modified files** with custom filenames
- **File size validation** with warnings for large files (>10MB)
- **Error handling** for corrupted or invalid files
- **Drag & drop support** for easy file loading

### User Experience
- **Progress indicator** for large file comparisons
- **Responsive design** optimized for desktop and mobile
- **Touch-friendly** interface with proper touch target sizes (44px minimum)
- **Accessibility features** with ARIA labels and screen reader support
- **Keyboard shortcuts** for power users
- **VS Code-inspired dark theme** for comfortable viewing

## Recent Improvements (v2.1.0)

### Performance Optimizations
- ✅ **Optimized LCS algorithm** - Uses Uint8Array for large files, reducing memory usage
- ✅ **Debounced scroll sync** - Smoother scrolling at ~60fps
- ✅ **Efficient HTML building** - Array join instead of string concatenation
- ✅ **CSS transition optimization** - Specific properties instead of 'all'

### Accessibility & UX
- ✅ **Focus trap for modal** - Keyboard navigation stays within modal
- ✅ **Focus-visible styles** - Clear keyboard navigation indicators
- ✅ **Window state persistence** - Remembers position, size, and maximized state

### Security & Stability
- ✅ **Content Security Policy** - Added CSP meta tag
- ✅ **Screen bounds validation** - Prevents window opening off-screen
- ✅ **Improved error handling** - Better Electron error dialogs

### Code Quality
- ✅ **DOM query caching** - 11 new cached element references
- ✅ **Named constants** - Extracted magic numbers
- ✅ **Consistent indentation** - Cleaned up code formatting
- ✅ **Fixed minimap bug** - Correct onclick handlers for both minimaps

## Browser Compatibility

TextCompare works on all modern browsers with ES6 support:

| Browser | Minimum Version |
|---------|----------------|
| Chrome  | 51+            |
| Firefox | 54+            |
| Safari  | 10+            |
| Edge    | 15+            |

**Required Features:**
- ES6 JavaScript (arrow functions, const/let, template literals)
- FileReader API
- CSS Flexbox
- CSS Custom Scrollbars (webkit)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Compare texts |
| `Ctrl+Up` | Previous difference |
| `Ctrl+Down` | Next difference |
| `Ctrl+S` | Save right file |
| `Ctrl+Shift+S` | Save left file |
| `Escape` | Close help modal / Exit compare mode |

## Usage

### Online (GitHub Pages)
Visit the live demo: [https://jj-repository.github.io/TextCompare/](https://jj-repository.github.io/TextCompare/)

### Desktop Applications (Electron)
Download native desktop applications for your platform:

**Linux:**
- AppImage (portable, works on most distributions)
- .deb package (Debian/Ubuntu)

**Windows:**
- Installer (.exe)
- Portable version (no installation required)

Desktop builds are automatically generated via GitHub Actions on every release. Check the [Releases](https://github.com/jj-repository/TextCompare/releases) page for downloads.

### Offline (Browser)
1. Download `index.html`
2. Open it in any modern web browser
3. No installation or build process required!

### How to Compare Files

1. **Load or paste text** into both the left and right panels
2. Click the **"Compare"** button or press `Ctrl+Enter`
3. View highlighted differences:
   - 🟢 **Green** - Added lines/text
   - 🔴 **Red** - Removed lines/text
   - 🟡 **Yellow/Red underline** - Modified characters
4. Use **Prev/Next** buttons or keyboard shortcuts to navigate between differences
5. Use the **minimap** on the right side for quick navigation
6. **Save** your changes when done

## Technical Details

### Architecture
- **Single-file application** - Zero dependencies, pure vanilla JavaScript
- **Client-side processing** - All comparisons happen in your browser (no server uploads)
- **Efficient algorithms** - LCS dynamic programming for optimal diff computation
- **Modular code** - IIFE pattern prevents global namespace pollution

### Performance
- **Optimized for files up to 10MB** - Larger files will show a warning
- **Async processing** - UI remains responsive during comparisons
- **Memory efficient** - Blob URLs properly cleaned up after file operations

### Security
- **No external dependencies** - No CDN or third-party scripts
- **Client-side only** - Your files never leave your computer
- **HTML escaping** - Protection against XSS via proper text escaping
- **Safe file handling** - FileReader API with error handling

## File Support

TextCompare supports all text-based file formats, including:
- Plain text (`.txt`)
- Markdown (`.md`)
- JSON (`.json`)
- XML/HTML (`.xml`, `.html`)
- Code files (`.js`, `.py`, `.java`, `.c`, `.cpp`, `.h`, `.css`)
- Config files (`.ini`, `.cfg`, `.yaml`, `.yml`)
- Logs (`.log`)
- CSV files (`.csv`)
- Any other text-based format

## Limitations

- **File size**: Recommended maximum of 10MB per file (browser may freeze on larger files)
- **Binary files**: Not supported (text files only)
- **Character encoding**: UTF-8 recommended (other encodings may display incorrectly)
- **Line endings**: Handles CRLF/LF automatically
- **Algorithm complexity**: O(m×n) time, optimized space usage with Uint8Array for large files

## Development

### Project Structure
```
TextCompare/
├── index.html                  # Complete web application (HTML + CSS + JS)
├── electron-main.js            # Electron main process
├── package.json                # Node.js dependencies and build config
├── icon.png                    # Application icon (512x512 PNG)
├── .github/
│   └── workflows/
│       ├── deploy.yml          # GitHub Pages deployment
│       └── build-executables.yml  # Desktop app builds
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

### Building Desktop Apps Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run in development mode:**
   ```bash
   npm start
   ```

3. **Build for your platform:**
   ```bash
   # Linux
   npm run build:linux

   # Windows
   npm run build:win

   # Both
   npm run build:all
   ```

4. **Find built executables in `dist/` folder**

**Note:** You'll need to add an `icon.png` (512x512) for the application icon. See `icon.png.txt` for details.

### Code Quality
- ✅ **Strict mode** enabled
- ✅ **No console errors** in production
- ✅ **Proper event cleanup**
- ✅ **WCAG 2.1 accessibility** compliant
- ✅ **Mobile-first** responsive design

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Changelog

### v2.1.0 (Latest - January 2026)
- ⚡ **Performance:** Optimized LCS algorithm with Uint8Array for large files
- ⚡ **Performance:** Debounced scroll sync for smoother 60fps scrolling
- ⚡ **Performance:** Array join for efficient HTML string building
- ♿ **Accessibility:** Added focus trap for help modal
- ♿ **Accessibility:** Added :focus-visible styles for keyboard navigation
- 🔒 **Security:** Added Content-Security-Policy meta tag
- 🔒 **Security:** Screen bounds validation prevents off-screen windows
- 💾 **Desktop:** Window state persistence (position, size, maximized)
- 🐛 **Bug fix:** Fixed minimap onclick handlers not working on left panel
- 🧹 **Code quality:** Cached 11 DOM element references
- 🧹 **Code quality:** Extracted magic numbers to named constants
- 🧹 **Code quality:** Fixed inconsistent indentation throughout

### v2.0.0 (December 2025)
- ✨ **Desktop apps:** Added Electron-based builds for Linux and Windows
- ✨ **GitHub Actions:** Automated desktop executable builds on releases
- ✨ Added file size validation with 10MB warning
- ✨ Added comprehensive error handling for file operations
- ✨ Added loading spinner for large file comparisons
- ✨ Improved accessibility with full ARIA support
- ✨ Enhanced mobile/touch support with 44px touch targets
- ✨ Wrapped JavaScript in IIFE pattern for better encapsulation
- ✨ Added responsive design for screens < 768px
- 🧹 Removed unused CSS classes
- 📚 Added comprehensive documentation
- 🐛 Fixed potential memory leaks with blob URL cleanup
- 📦 Added package.json and Electron configuration
- 🤖 Added automated build workflow for cross-platform executables

### v1.0.0 (Initial Release)
- 🎉 Initial release with core diff functionality
- 📝 Side-by-side text comparison
- 🎨 VS Code-inspired dark theme
- ⌨️ Keyboard shortcuts
- 🗺️ Minimap for navigation
- 💾 File load/save capabilities

## Credits

Created with ❤️ using vanilla JavaScript, no frameworks required.

Algorithm: Longest Common Subsequence (LCS) dynamic programming approach.

## Support

If you encounter any issues or have suggestions, please open an issue on GitHub.

---

**Live Demo:** [https://jj-repository.github.io/TextCompare/](https://jj-repository.github.io/TextCompare/)
