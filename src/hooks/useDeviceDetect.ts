import { useState, useEffect } from 'react';

export type DeviceType = 'ios' | 'android' | 'desktop';

interface DeviceInfo {
  type: DeviceType;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isPWA: boolean;
  browser: 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other';
}

export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    isIOS: false,
    isAndroid: false,
    isDesktop: true,
    isMobile: false,
    isPWA: false,
    browser: 'other',
  });

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Detect iOS
    const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    // Detect Android
    const isAndroid = /android/.test(userAgent);
    
    // Detect if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    
    // Detect browser
    let browser: DeviceInfo['browser'] = 'other';
    if (/samsungbrowser/.test(userAgent)) {
      browser = 'samsung';
    } else if (/edg/.test(userAgent)) {
      browser = 'edge';
    } else if (/chrome/.test(userAgent) && !/edg/.test(userAgent)) {
      browser = 'chrome';
    } else if (/firefox/.test(userAgent)) {
      browser = 'firefox';
    } else if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) {
      browser = 'safari';
    }

    // Determine type
    let type: DeviceType = 'desktop';
    if (isIOS) {
      type = 'ios';
    } else if (isAndroid) {
      type = 'android';
    }

    setDeviceInfo({
      type,
      isIOS,
      isAndroid,
      isDesktop: !isIOS && !isAndroid,
      isMobile: isIOS || isAndroid,
      isPWA,
      browser,
    });
  }, []);

  return deviceInfo;
}
