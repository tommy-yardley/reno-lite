# Mobile builds

RenoLite uses Capacitor to package the same responsive interface for Android and iOS. The web app, tests and native exports remain the source of truth; platform wrappers are generated from `capacitor.config.json`.

## Installable Android APK from GitHub

Open **Actions → Android APK → Run workflow**. A tested installable debug APK will be available under the run's **Artifacts** section.

For a versioned release, push a tag such as `v0.2.0`. The workflow builds the same APK and attaches it to a new GitHub Release with generated release notes.

## Local Android or iOS development

```bash
npm install
npm run build
npx cap add android   # or: npx cap add ios
npx cap sync
```

Then run `npx cap open android` or `npx cap open ios`. Android requires Android Studio; iOS requires macOS and Xcode. Generated `android/` and `ios/` folders are ignored in this repository because CI recreates them. If native code, signing or app-store assets are customised later, commit the relevant platform project at that point and simplify the workflow to sync it instead of regenerating it.

## Native features already wired up

- PNG, SVG, PDF and DXF exports use the native share sheet.
- The reference-plan picker can use the camera or photo library.
- Plans persist in the Capacitor WebView through the same local storage layer.

For a committed iOS project, add camera and photo-library usage descriptions to `Info.plist` before distributing a build.
