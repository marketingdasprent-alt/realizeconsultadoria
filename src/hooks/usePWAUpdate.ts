// PWA update is now handled automatically via registerSW in main.tsx
// This hook is kept as a no-op for backwards compatibility
export function usePWAUpdate() {
  return { needRefresh: false };
}
