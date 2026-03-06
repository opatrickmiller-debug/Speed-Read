# Isotope - Native App Build Guide

This guide explains how to build native iOS and Android apps from the Isotope Keto Nutrition Tracker.

## Prerequisites

### For iOS Builds
- macOS with Xcode 14+ installed
- Apple Developer Account (for App Store distribution)
- CocoaPods (`sudo gem install cocoapods`)

### For Android Builds
- Android Studio with SDK 33+
- Java Development Kit (JDK) 17+
- Google Play Developer Account (for Play Store distribution)

## Quick Start

### 1. Build the React App
```bash
cd /app/frontend
yarn build
```

### 2. Sync with Native Platforms
```bash
npx cap sync
```

### 3. Open in Native IDE

**For iOS:**
```bash
npx cap open ios
```
This opens Xcode. Then:
1. Select your development team in Signing & Capabilities
2. Connect an iOS device or select a simulator
3. Click Run (▶️)

**For Android:**
```bash
npx cap open android
```
This opens Android Studio. Then:
1. Wait for Gradle sync to complete
2. Connect an Android device or start an emulator
3. Click Run (▶️)

## Building for Production

### iOS App Store Build

1. In Xcode, select "Any iOS Device" as the target
2. Go to Product → Archive
3. Once archived, click "Distribute App"
4. Select "App Store Connect" → "Upload"
5. Follow the prompts to upload to App Store Connect

### Android Play Store Build

1. In Android Studio, go to Build → Generate Signed Bundle/APK
2. Select "Android App Bundle"
3. Create or select your keystore
4. Choose "release" build variant
5. The `.aab` file will be in `android/app/release/`

## App Configuration

### App Details (capacitor.config.ts)
- **App ID**: `com.isotope.app`
- **App Name**: `Isotope`
- **Web Directory**: `build`

### Changing App Icons

Place your icons in:
- **iOS**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- **Android**: `android/app/src/main/res/mipmap-*/`

Recommended sizes:
- iOS: 1024x1024 (App Store), 180x180 (iPhone), 167x167 (iPad Pro)
- Android: 512x512 (Play Store), 192x192 (xxxhdpi), 144x144 (xxhdpi)

### Updating Splash Screen

The splash screen is configured in `capacitor.config.ts`:
```typescript
SplashScreen: {
  launchShowDuration: 2000,
  backgroundColor: "#050505",
  splashFullScreen: true
}
```

## Live Reload (Development)

For development with live reload:

```bash
# Start the React dev server
yarn start

# In another terminal, run with live reload
npx cap run ios --livereload --external
# or
npx cap run android --livereload --external
```

## Troubleshooting

### iOS Build Issues
- **Pod install fails**: Run `cd ios/App && pod install --repo-update`
- **Signing issues**: Ensure you've selected a valid development team
- **Deployment target**: Minimum iOS 14.0 required

### Android Build Issues
- **Gradle sync fails**: File → Invalidate Caches → Restart
- **SDK not found**: Install SDK 33 via SDK Manager
- **Build variant**: Ensure "release" is selected for production

## Native Plugins Installed

- `@capacitor/app` - App lifecycle management
- `@capacitor/haptics` - Haptic feedback
- `@capacitor/keyboard` - Keyboard handling
- `@capacitor/status-bar` - Status bar customization

## Support

For issues with native builds, refer to:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Development Guide](https://capacitorjs.com/docs/ios)
- [Android Development Guide](https://capacitorjs.com/docs/android)
