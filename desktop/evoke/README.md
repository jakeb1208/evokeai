# Evoke AI for Windows

This is an installable Windows desktop shell for the live Evoke AI site at
`https://evokeai-production.up.railway.app/`. It requires an internet connection.
Your account, worlds, Supabase storage, and Marble generation continue to run
through the existing Railway service; no API credentials are bundled in the app.
The desktop window supports WebGL and mouse pointer lock for the world viewer.

## Build a Windows installer

On a Windows machine with Node.js 22 or newer:

```powershell
cd desktop\evoke
npm install
npm run package:win
```

The resulting installer is `desktop/evoke/release/Evoke-AI-Setup-1.0.0.exe`.
Alternatively, push the repository to GitHub and run the **Windows desktop
installer** workflow from the Actions tab. Download the installer artifact from
that workflow's completed run.

The installer is **unsigned**. Windows SmartScreen may warn until it is signed
with a trusted Windows code-signing certificate. Do not bypass that warning for
an installer received from an untrusted source. Code signing and automatic
updates are not configured.

## Configuration

The trusted site URL is fixed in `main.cjs`. If the Railway domain changes,
update that URL, build a new installer, and install the new version. The desktop
app never needs `MARBLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or other server
secrets; keep those on Railway.