import { useState, useEffect } from 'react';

export type ScreenProfile = 'kiosk-hd' | 'kiosk-fhd' | 'mobile' | 'tablet' | 'desktop';

interface ScreenDimensions {
  width: number;
  height: number;
  profile: ScreenProfile;
  isKiosk: boolean;
  scaleFactor: number;
}

export const useScreenSize = (): ScreenDimensions => {
  const [dimensions, setDimensions] = useState<ScreenDimensions>(() => 
    calculateDimensions(window.innerWidth, window.innerHeight)
  );

  useEffect(() => {
    const handleResize = () => {
      setDimensions(calculateDimensions(window.innerWidth, window.innerHeight));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return dimensions;
};

function calculateDimensions(width: number, height: number): ScreenDimensions {
  const aspectRatio = height / width;
  
  // Detect screen profile based on resolution
  let profile: ScreenProfile = 'mobile';
  let isKiosk = false;
  let scaleFactor = 1;

  // Full HD Kiosk (1080 x 1920) - aspect ratio ~1.78
  if (width >= 1000 && width <= 1200 && height >= 1850 && height <= 2000) {
    profile = 'kiosk-hd';
    isKiosk = true;
    scaleFactor = 1.0;
  }
  // Extended Kiosk/Mobile (1080 x 2400) - aspect ratio ~2.22
  else if (width >= 1000 && width <= 1200 && height >= 2300 && height <= 2500) {
    profile = 'kiosk-fhd';
    isKiosk = true;
    scaleFactor = 1.15; // Scale up slightly for taller screens
  }
  // Tablet
  else if (width >= 768 && width <= 1024) {
    profile = 'tablet';
    scaleFactor = 0.9;
  }
  // Desktop
  else if (width > 1024) {
    profile = 'desktop';
    scaleFactor = 0.85;
  }
  // Mobile (default)
  else {
    profile = 'mobile';
    scaleFactor = aspectRatio > 2 ? 1.1 : 1.0;
  }

  return {
    width,
    height,
    profile,
    isKiosk,
    scaleFactor
  };
}
