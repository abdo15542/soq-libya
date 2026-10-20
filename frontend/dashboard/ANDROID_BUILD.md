# سوق ليبيا — Android APK

The Android wrapper is built with Capacitor. The APK is a native Android package containing the web frontend; it still requires a reachable production API for account, product, order, chat, and delivery features.

## Build APK through GitHub Actions

1. Push this repository/branch to GitHub.
2. Open **Actions → Build Android APK → Run workflow** (or wait for a matching push).
3. Open the successful workflow run.
4. Download the `soq-libya-debug-apk` artifact and extract `app-debug.apk`.
5. Install it on a test Android device and verify sign-in, browsing, product details, cart/order flow, chat, and location permissions against the deployed API.

Set repository Actions variables before building:
- `VITE_API_URL`: full API base URL ending in `/api`, e.g. `https://your-api.example.com/api`.
- `VITE_VAPID_PUBLIC_KEY`: public VAPID key if web push is configured.

If `VITE_API_URL` is not set, the frontend may fall back to a development URL and will not work correctly on a user's phone. Confirm the value used by `src/utils/api.js` before release.

## Local build

From `frontend/dashboard` with Node.js 20, Java 17, Android SDK and Gradle prerequisites installed:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Important release notes

- This workflow creates a **debug/test APK**, not a Play Store-ready signed release.
- A production release requires a private signing key and secure GitHub Actions secrets. Never commit a keystore, passwords, API secrets, database credentials, or private VAPID keys.
- APK generation does not itself deploy the backend or database. The production API, database migrations, CORS/Socket.IO origins, authentication and authorization must be configured and security-tested separately.
- Do not use this APK for real customers until the existing authentication, ownership checks, payment/payout logic, uploads, and order lifecycle issues have been fixed and tested.
