# Trippin' TV — Android (Capacitor)

The web app is wrapped with **Capacitor** so it builds as a native Android app
reusing 100% of the existing React/Vite code. The native project lives in
`android/`.

## Prerequisites (one-time, on your machine)
- **JDK 21** (AGP 8.13 requires it; `sudo apt install openjdk-21-jdk` / brew / etc.)
- **Android Studio** or just the **Android SDK command-line tools**
  - `sdkmanager "platforms;android-36" "build-tools;36.0.0"`
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

### 1. Generate your upload keystore (locally — never commit it)
```bash
keytool -genkey -v -keystore trippintv-release.keystore \
  -alias trippintv -keyalg RSA -keysize 2048 -validity 10000
```
Save the store password + key password somewhere safe (password manager).
This keystore is your app's signing identity — keep it private and back it up.

### 2. Wire it locally (optional; for local builds)
```bash
cp android/keystore.properties.example android/keystore.properties
# edit android/keystore.properties with your values, then:
npm run android:build:release
# AAB at: android/app/build/outputs/bundle/release/app-release.aab
```

### 3. Build a signed AAB in CI (GitHub Actions)
Add these **repo secrets** (Settings → Secrets → Actions):
- `RELEASE_KEYSTORE_BASE64` — `base64 -w0 trippintv-release.keystore`
- `RELEASE_KEYSTORE_PASSWORD` — your store password
- `RELEASE_KEY_ALIAS` — `trippintv`
- `RELEASE_KEY_PASSWORD` — your key password

Push to `main` (or dispatch the workflow). CI builds **both** the debug APK and
a **signed** `app-release.aab` and uploads them as artifacts. The AAB step is
skipped (and not uploaded) if the keystore secrets are absent.

> Lose the keystore and you cannot update the app on the Play Store under the
> same identity — store it securely and keep a backup.

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
