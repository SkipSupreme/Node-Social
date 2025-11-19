// src/config.ts
// For iOS Simulator/Android Emulator, use localhost
// For physical device, use your Mac's local IP (find with: ifconfig | grep "inet ")
const LOCAL_DEV_IP = "localhost"; // Change to your Mac's IP if testing on physical device

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  `http://${LOCAL_DEV_IP}:3000`;