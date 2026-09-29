# Evoke AI for Windows and Linux

This desktop app opens the live Evoke AI site at
`https://evokeai-production.up.railway.app/`. It requires an internet connection.
Your account, worlds, Supabase storage, and Marble generation continue to run
through the existing Railway service; no API credentials are bundled in the app.
The desktop window supports WebGL and mouse pointer lock for the world viewer.

## Download an installer

After the latest code has been pushed to GitHub:

1. Open [the Evoke AI Actions page](https://github.com/jakeb1208/evokeai/actions)
   and select **Desktop installers**.
2. Choose the latest successful run (or click **Run workflow** and wait for it
   to finish).
3. Under **Artifacts**, download **Evoke-AI-Windows-Installer** or
   **Evoke-AI-Linux-AppImage**. Unzip the downloaded artifact.
4. On Windows, run `Evoke-AI-Setup-1.0.0.exe`. On Linux x64, make the AppImage
   executable and run it:

   ```bash
   chmod +x Evoke-AI-1.0.0.AppImage
   ./Evoke-AI-1.0.0.AppImage
   ```

The workflow builds both packages on their respective operating systems. A
successful source-code check does **not** mean an installer has been built; wait
for a green workflow run before downloading. GitHub may require you to sign in
to download workflow artifacts.

## Build locally instead

Install Node.js 22 or newer, then from `desktop/evoke` run:

```bash
npm install
npm test
npm run package:linux   # Linux x64 AppImage
# or
npm run package:win     # Windows x64 installer, run on Windows
```

Output files appear in `desktop/evoke/release/`. Some Linux distributions need
FUSE support to launch an AppImage; if unavailable, try the AppImage's
`--appimage-extract-and-run` option.

The Windows installer is **unsigned**, so Windows SmartScreen may warn until it
is signed with a trusted code-signing certificate. Do not bypass that warning
for an installer received from an untrusted source. Code signing and automatic
updates are not configured.

## Configuration

The trusted site URL is fixed in `main.cjs`. If the Railway domain changes,
update that URL, build new installers, and install the new version. The desktop
app never needs `MARBLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or other server
secrets; keep those on Railway.