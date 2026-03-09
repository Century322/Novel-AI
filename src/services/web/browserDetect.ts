export type BrowserType = 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'other';
export type PlatformType = 'windows' | 'mac' | 'linux' | 'mobile' | 'other';

export interface BrowserCapabilities {
  isMobile: boolean;
  browser: BrowserType;
  platform: PlatformType;
  supportsFileSystemAccess: boolean;
  supportsIndexedDB: boolean;
}

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'chrome';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari';
  if (ua.includes('opera') || ua.includes('opr/')) return 'opera';
  return 'other';
}

function detectPlatform(): PlatformType {
  const ua = navigator.userAgent.toLowerCase();
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return 'other';
}

function checkFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window && 'showOpenFilePicker' in window;
}

function checkIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function getBrowserCapabilities(): BrowserCapabilities {
  return {
    isMobile: detectPlatform() === 'mobile',
    browser: detectBrowser(),
    platform: detectPlatform(),
    supportsFileSystemAccess: checkFileSystemAccess(),
    supportsIndexedDB: checkIndexedDB(),
  };
}

export const browserCapabilities = getBrowserCapabilities();

export function isPcBrowser(): boolean {
  const caps = getBrowserCapabilities();
  return !caps.isMobile;
}

export function needsIndexedDBFallback(): boolean {
  const caps = getBrowserCapabilities();
  return !caps.supportsFileSystemAccess;
}
