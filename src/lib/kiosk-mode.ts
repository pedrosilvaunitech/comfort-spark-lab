import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Kiosk mode utilities for Android
 * Hides status bar, navigation, prevents back button, etc.
 */
export function useKioskMode() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Try to hide status bar via Capacitor plugin
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.hide();
      StatusBar.setStyle({ style: Style.Dark });
    }).catch(() => {});

    // Prevent back button on Android
    const handleBackButton = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('backbutton', handleBackButton, true);
    
    // Disable context menu and text selection
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    // Request fullscreen on web fallback
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // Lock to landscape orientation
    try {
      const screenAny = screen as any;
      if (screenAny.orientation?.lock) {
        screenAny.orientation.lock('landscape').catch(() => {});
      }
    } catch {}

    return () => {
      document.removeEventListener('backbutton', handleBackButton, true);
    };
  }, []);
}

/**
 * CSS class additions for kiosk mode
 */
export const kioskStyles = `
  .kiosk-mode {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }
`;
