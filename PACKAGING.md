# CalmCampus Packaging Setup

CalmCampus can be packaged as native Android and Windows wrappers that load the live app:

```text
https://calmcampus.onrender.com
```

The wrappers do not include API keys. Talk Assistant requests go to the deployed Render backend at `/api/talk`, where provider keys remain server-side.

## Environment

Use this value when syncing or running the wrappers:

```powershell
$env:PUBLIC_APP_URL="https://calmcampus.onrender.com"
```

The repository also includes `.env.example` with:

```text
PUBLIC_APP_URL=https://calmcampus.onrender.com
```

## Install Dependencies

Run from the repository root:

```powershell
npm install
```

Then confirm the existing website still builds:

```powershell
npm run build
```

## Android APK

The Android app uses Capacitor with:

```text
App name: CalmCampus
Package id: com.calmcampus.app
Live app URL: https://calmcampus.onrender.com
```

First-time Android project setup:

```powershell
npx cap add android
```

Sync the wrapper configuration:

```powershell
npx cross-env PUBLIC_APP_URL=https://calmcampus.onrender.com npx cap sync android
```

Open Android Studio:

```powershell
npx cap open android
```

In Android Studio, build the APK from:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

Debug APK output path:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

For a release APK, use Android Studio's signed APK flow:

```text
Build > Generate Signed Bundle / APK
```

## Windows Installer

The Windows desktop app uses Electron and electron-builder with:

```text
App name: CalmCampus
Live app URL: https://calmcampus.onrender.com
Installer target: NSIS
```

Run the desktop wrapper locally:

```powershell
npm run electron:dev
```

Build the Windows installer:

```powershell
npm run electron:build
```

Installer output path:

```text
release\CalmCampus-Setup-<version>.exe
```

The Electron wrapper hides the menu bar and opens external links in the user's default browser.

## Security Notes

Do not add provider keys to frontend code, Capacitor config, Electron config, `.env.example`, or packaged app files. Keys for Gemini, Groq, OpenRouter, Mistral, and other providers belong only in the Render service environment.
