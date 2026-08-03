// Lets the user snap/select the floor plan photo through the native camera or photo
// library on iOS/Android, instead of only the plain <input type="file"> picker.
// Returns a data URL, or null if unavailable/cancelled — callers should treat null
// as "do nothing" rather than an error.

import { Capacitor } from "@capacitor/core";

export async function captureFloorPlanPhoto() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // lets the user pick "Camera" or "Photo Library"
    });
    return photo?.dataUrl ?? null;
  } catch (err) {
    // User cancelled the picker, or the plugin isn't available — not a real error.
    console.warn("Camera capture cancelled or unavailable:", err);
    return null;
  }
}
