# Building Custom Dev Build

This guide will help you create a custom development build that supports SecureStore and all native modules.

## Option 1: EAS Build (Cloud - Recommended)

EAS Build creates builds in the cloud, so you don't need Xcode or Android Studio installed.

### Prerequisites
1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login` (create account at https://expo.dev if needed)

### Build Steps

**For iOS Simulator:**
```bash
cd app
eas build --profile development --platform ios
```

**For Android Device/Emulator:**
```bash
cd app
eas build --profile development --platform android
```

**For Physical iOS Device:**
You'll need an Apple Developer account ($99/year). Then:
```bash
cd app
eas build --profile preview --platform ios
```

### After Build Completes
1. Download the build from the EAS dashboard (link provided after build)
2. Install on your device/simulator:
   - **iOS Simulator**: Drag the `.app` file to simulator
   - **Android**: Install the `.apk` file
   - **iOS Device**: Install via TestFlight or direct install
3. Start the dev server: `npm start` (or `expo start`)
4. The app will connect to your local dev server automatically

## Option 2: Local Build (Requires Xcode/Android Studio)

Build locally on your machine. Faster iteration but requires setup.

### Prerequisites

**For iOS:**
- macOS
- Xcode (from App Store)
- CocoaPods: `sudo gem install cocoapods`

**For Android:**
- Android Studio
- Android SDK
- Java Development Kit (JDK)

### Build Steps

1. **Generate native projects:**
   ```bash
   cd app
   npm run prebuild
   ```
   This creates `ios/` and `android/` directories.

2. **Build and run:**

   **iOS:**
   ```bash
   npm run build:ios:local
   # Or: npx expo run:ios
   ```

   **Android:**
   ```bash
   npm run build:android:local
   # Or: npx expo run:android
   ```

3. **Start dev server:**
   The build command will automatically start Metro bundler, or you can run:
   ```bash
   npm start
   ```

## Testing Your Build

Once the app is installed:

1. **Start your backend API:**
   ```bash
   cd backend/api
   npm run dev
   ```

2. **Update API URL in app** (`app/src/config.ts`):
   - For simulator/emulator: Use `localhost:3000`
   - For physical device: Use your Mac's IP address (find with `ifconfig`)

3. **Test the auth flow:**
   - Register a new user
   - Login
   - Verify tokens are stored securely in SecureStore
   - Test token refresh
   - Test logout

## Troubleshooting

### "SecureStore not available" error
- Make sure you're using a custom dev build, not Expo Go
- Rebuild the app after adding native modules

### Build fails
- Check that all dependencies are installed: `npm install`
- For iOS: Make sure CocoaPods are installed: `cd ios && pod install`
- Clear cache: `expo start -c`

### Can't connect to API
- Check API server is running: `curl http://localhost:3000/health`
- For physical device, ensure Mac and device are on same WiFi
- Update `LOCAL_DEV_IP` in `app/src/config.ts` to your Mac's IP

## Next Steps

After your dev build is working:
- Test all auth flows (register, login, refresh, logout)
- Verify SecureStore is working (tokens persist after app restart)
- Test on both iOS and Android
- When ready for production, use `eas build --profile production`

