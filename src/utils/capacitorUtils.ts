/**
 * Safe Capacitor utilities
 * 
 * These functions wrap Capacitor calls to prevent crashes when
 * Capacitor JS bridge isn't fully initialized on startup.
 */

/**
 * Safely check if running on a native platform (Android/iOS)
 * Returns false if Capacitor is not available or not initialized
 */
export const isNativePlatform = (): boolean => {
  try {
    // Check if Capacitor global is available
    const cap = (window as any).Capacitor;
    if (!cap) return false;
    
    // Check if isNativePlatform method exists
    if (typeof cap.isNativePlatform === 'function') {
      return cap.isNativePlatform();
    }
    
    // Fallback: check platform property
    if (cap.platform && cap.platform !== 'web') {
      return true;
    }
    
    // Fallback: check getPlatform method
    if (typeof cap.getPlatform === 'function') {
      const platform = cap.getPlatform();
      return platform === 'android' || platform === 'ios';
    }
    
    return false;
  } catch (error) {
    console.warn('[CapacitorUtils] Error checking native platform:', error);
    return false;
  }
};

/**
 * Safely get the current platform
 * Returns 'web' if Capacitor is not available
 */
export const getPlatform = (): 'android' | 'ios' | 'web' => {
  try {
    const cap = (window as any).Capacitor;
    if (!cap) return 'web';
    
    if (typeof cap.getPlatform === 'function') {
      const platform = cap.getPlatform();
      if (platform === 'android' || platform === 'ios') {
        return platform;
      }
    }
    
    // Fallback
    if (cap.platform === 'android') return 'android';
    if (cap.platform === 'ios') return 'ios';
    
    return 'web';
  } catch (error) {
    console.warn('[CapacitorUtils] Error getting platform:', error);
    return 'web';
  }
};

/**
 * Check if Capacitor is available and initialized
 */
export const isCapacitorAvailable = (): boolean => {
  try {
    return typeof (window as any).Capacitor !== 'undefined';
  } catch {
    return false;
  }
};
