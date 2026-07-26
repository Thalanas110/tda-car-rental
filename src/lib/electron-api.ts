export function electronApi() {
  if (!window.tda) {
    throw new Error("TDA Car Rental must be opened through the Electron desktop app.");
  }
  return window.tda;
}
