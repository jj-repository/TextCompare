# Development

## Run & Build
```bash
npm install
npm start                # dev
npm run build:linux      # AppImage → TextCompare-Linux.AppImage
npm run build:win        # portable exe → TextCompare.exe
npm run build:all
```

## Build Config
```json
{
  "appId": "com.textcompare.app",
  "linux": { "target": ["AppImage"], "artifactName": "TextCompare-Linux.${ext}" },
  "win": { "target": ["portable"], "artifactName": "TextCompare.${ext}" }
}
```

## Dependencies
```json
{ "electron": "^39.2.7", "electron-builder": "^26.0.12" }
```
No runtime dependencies.
