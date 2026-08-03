# Building Draft Room as a phone app (Capacitor)

This wraps the existing web app in a native iOS/Android shell. It's already scaffolded
(`capacitor.config.json` and the dependencies are in `package.json`) — the steps below
are what you run locally, since they need Xcode/Android Studio installed, which isn't
something that can be done from a sandbox.

## Prerequisites

- **iOS builds:** a Mac with Xcode installed (free), and a free or paid Apple Developer
  account (free accounts can run on your own device for 7 days at a time before
  needing a re-install; a paid account, $99/year, is required for App Store
  distribution or longer-lived installs).
- **Android builds:** [Android Studio](https://developer.android.com/studio)
  installed (free, any OS). A Google Play developer account ($25 one-time) is only
  needed for Play Store distribution — running on your own device is free.

## One-time setup

```bash
npm install
npx cap add ios       # only if you're building for iPhone
npx cap add android   # only if you're building for Android
```

This generates real native project folders (`ios/` and `android/`) — commit these to
the repo once they exist, they're not fully regenerable from config alone once you
start customizing icons/permissions/etc.

## Everyday workflow

Every time you change the web app and want to see it on your phone:

```bash
npm run cap:ios       # builds the web app, syncs it into the iOS project, opens Xcode
npm run cap:android   # same, but opens Android Studio
```

From there:
- **iOS:** pick your device (or a simulator) from the dropdown at the top of Xcode,
  hit the ▶ Run button. First run on a real device will ask you to trust the
  developer certificate in Settings → General → VPN & Device Management.
- **Android:** pick your device/emulator in Android Studio's device dropdown, hit ▶ Run.
  A physical phone needs USB debugging enabled (Settings → About phone → tap Build
  Number 7 times → Developer Options → USB debugging).

## What's already wired up

- **Exports (PNG/SVG/PDF/DXF)** detect whether they're running natively
  (`Capacitor.isNativePlatform()`). On the web they still do a normal browser
  download. Inside the native shell, they write to the app's cache via
  `@capacitor/filesystem` and open the native share sheet via `@capacitor/share`, so
  the user can save to Files/Photos or send it elsewhere. See `src/lib/nativeExport.js`.
- **Camera capture**: a "Take a photo" button appears (native builds only) next to
  the upload button, using `@capacitor/camera`. `CameraSource.Prompt` lets the user
  choose between the camera and their photo library from one button. See
  `src/lib/nativeCamera.js`.
- **Persistence** (`localStorage`, via `src/lib/storage.js`) works as-is inside a
  Capacitor WebView — no change needed there.

## One manual step: iOS permission strings

Camera/photo-library access on iOS requires usage-description strings in
`Info.plist`, and Capacitor doesn't generate these for you. After `npx cap add ios`,
open `ios/App/App/Info.plist` and add:

```xml
<key>NSCameraUsageDescription</key>
<string>Draft Room uses your camera to photograph a floor plan to trace.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Draft Room needs photo library access to pick an existing floor plan photo.</string>
```

Without these, the camera call will crash the app on a real device (simulators are
sometimes more forgiving, which is a common way this gets missed until too late).
Android doesn't need anything extra here — the plugin's manifest merges in
automatically.

After installing the camera/filesystem/share plugins (already in `package.json`),
run `npm install` then `npx cap sync` again before opening Xcode/Android Studio so
the native projects pick up the new plugins.

## App icons & splash screen

Capacitor uses whatever's in `ios/App/App/Assets.xcassets` and
`android/app/src/main/res` once the native projects exist. The
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) tool can
generate all required sizes from a single 1024×1024 icon and a splash image — worth
running once you have real artwork.

## Distributing it

- **TestFlight / internal testing** is the easiest way to get it on other people's
  phones without going through full App Store / Play Store review — worth doing
  before a public release either way.
- Full store submission (screenshots, privacy policy, content rating, review) is a
  separate process on each store's side and isn't something I can prepare for you
  without knowing which store(s) you're targeting and having store-listing assets —
  let me know if/when you get there.
