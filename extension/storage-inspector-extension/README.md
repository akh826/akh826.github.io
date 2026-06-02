# Site Storage Inspector (Browser Extension)

Inspect **any website you have open in a tab** — localStorage, sessionStorage, Cache Storage, IndexedDB, and cookies (including **HttpOnly**).

## One-click install (recommended)

### Windows / Mac (downloaded ZIP)

1. Download **`extension/storage-inspector-extension.zip`** from the repo or the Storage Inspector tool page.
2. Extract the ZIP.
3. Double-click **`Install.bat`** (Windows) or **`Install.command`** (Mac).

Chrome or Edge opens with the extension loaded for that session. Pin it from the puzzle toolbar icon.

To keep it after browser restarts: `chrome://extensions` → **Developer mode** → **Load unpacked** → select the same unzipped folder (one-time).

### Repo clone

Double-click **`Install.bat`** inside `extension/storage-inspector-extension/` (no ZIP needed).

## Manual install

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** → **Load unpacked**.
3. Select this folder: `extension/storage-inspector-extension/`.

## Use

1. Navigate to the site you want to inspect.
2. Click the extension icon → **Inspect active tab**.
3. Optional: **Open full report**.

## Rebuild ZIP (maintainers)

```powershell
powershell -ExecutionPolicy Bypass -File extension/build-extension-zip.ps1
```

## Limits

- Cannot inspect `chrome://`, `edge://`, `about:`, or the Web Store.
- HTTP disk cache cannot be listed from JavaScript.
- A website cannot install extensions with a true browser “Add extension” button without the Chrome Web Store.

## Web tool

`tools/storage-quota/` only reads **its own origin**. Use this extension for other sites.
