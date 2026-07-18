# Trippin' TV — Android (Capacitor)

The web app is wrapped with **Capacitor** so it builds as a native Android app
reusing 100% of the existing React/Vite code. The native project lives in
`android/`.

## Prerequisites (one-time, on your machine)
- **JDK 17** (`sudo apt install openjdk-17-jdk` / brew / etc.)
- **Android Studio** or just the **Android SDK command-line tools**
  - `sdkmanager "platforms;android-36" "build-tools;36.0.0" "ndk;27.0.12077973"`
  - Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) to the SDK path.
- Accept licenses: `sdkmanager --licenses`

## Build a debug APK
```bash
npm install
npm run build            # builds web assets into dist/
npx cap sync android     # copies web assets + updates native project
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```
Or in one shot: `npm run android:build`

## Build a release (Play Store) AAB
```bash
npm run android:build:release
# AAB at: android/app/build/outputs/bundle/release/app-release.aab
```
Generate an upload key and reference it in `android/app/build.gradle`
(release signing config) before publishing.

## Connecting to the backend
- The web app calls the API via **relative** `/api/...` paths and uses
  `VITE_SUPABASE_URL` for auth (set in `.env`).
- In production the Express backend must be **hosted** and reachable from the
  device. Set `VITE_API_URL=https://your-backend.example.com` in `.env` so API
  calls (and the Google OAuth `redirectTo`) point at the hosted backend
  instead of the WebView origin. Leave it empty for same-origin dev.
- For local device testing against the dev server, enable the `server.url`
  line in `capacitor.config.ts` (use `http://10.0.2.2:3000` to reach the
  host's localhost from the emulator) and rebuild.

## Features wired for mobile
- Installable / standalone (manifest + icons)
- Safe-area insets, larger touch targets
- Deep links: `trippintv://v/:id` and `trippintv://u/:id`
- Camera / storage permissions for video upload
- Cleartext traffic allowed for dev

## Notes
- `android/` is committed (Capacitor convention) so teammates can build directly.
- Run `npx cap sync android` after any web change before rebuilding native.
