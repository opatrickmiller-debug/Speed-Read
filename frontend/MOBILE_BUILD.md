# Isotope - Mobile App Build Guide

## PWA Installation (Instant - No Build Required)

### iPhone/iPad (Safari)
1. Open https://keto-nutrition-hub.preview.emergentagent.com in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right

### Android (Chrome)
1. Open https://keto-nutrition-hub.preview.emergentagent.com in Chrome
2. Tap the **menu** (⋮) in the top right
3. Tap **"Add to Home Screen"** or **"Install app"**
4. Tap **"Install"**

---

## Native App Build (iOS & Android)

### Prerequisites
- **Mac** with Xcode 15+ (for iOS builds)
- **Android Studio** with SDK 34+ (for Android builds)
- Node.js 18+
- Yarn package manager

### Initial Setup

```bash
cd frontend

# Install dependencies
yarn install

# Build the web app
yarn build

# Initialize Capacitor projects
yarn cap:add:ios      # For iOS
yarn cap:add:android  # For Android

# Sync web build to native projects
yarn cap:sync
```

### Build for iOS

```bash
# Open in Xcode
yarn cap:open:ios
```

In Xcode:
1. Select your team in **Signing & Capabilities**
2. Connect your iPhone or select a simulator
3. Press **Cmd+R** to build and run

**To submit to App Store:**
1. Product → Archive
2. Distribute App → App Store Connect

### Build for Android

```bash
# Open in Android Studio
yarn cap:open:android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Connect your Android device or start an emulator
3. Press **Run** (green play button)

**To create release APK:**
1. Build → Generate Signed Bundle/APK
2. Select APK
3. Create or use existing keystore
4. Build release

### Update After Code Changes

```bash
# Rebuild and sync
yarn build:mobile
```

---

## App Configuration

### capacitor.config.ts
- App ID: `com.isotope.app`
- App Name: `Isotope`
- Theme color: `#10B981` (emerald)
- Background: `#050505` (dark)

### Changing App ID for Store Submission
Edit `capacitor.config.ts`:
```typescript
appId: 'com.yourcompany.isotope',
```

Then run:
```bash
yarn cap:sync
```

---

## Features

### PWA Features
- Offline support (cached pages work without internet)
- Install prompt (appears after 30 seconds of use)
- App shortcuts (Search Food, Food Log, Scan Barcode)
- Home screen icon

### Native App Features
- Status bar customization
- Keyboard handling
- Haptic feedback
- Back button handling (Android)
- Native splash screen

---

## Troubleshooting

### iOS: "No signing certificate"
Open Xcode → Preferences → Accounts → Add Apple ID

### Android: "SDK not found"
Open Android Studio → SDK Manager → Install Android SDK 34

### Build fails after update
```bash
yarn cap:sync
```

### App shows old content
```bash
yarn build && yarn cap:copy
```
