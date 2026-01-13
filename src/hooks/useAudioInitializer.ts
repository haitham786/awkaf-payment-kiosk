import { useEffect, useState } from 'react';
import { soundManager } from '@/utils/soundEffects';

/**
 * Hook to initialize audio on first user interaction
 * Handles mobile browser autoplay restrictions
 */
export const useAudioInitializer = () => {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [showInitPrompt, setShowInitPrompt] = useState(false);

  useEffect(() => {
    let initialized = false;

    const initializeAudio = async () => {
      if (initialized) return;
      initialized = true;

      try {
        await soundManager.initialize();
        setIsAudioReady(true);
        setShowInitPrompt(false);
        console.log('✅ Audio system initialized successfully');
      } catch (error) {
        console.error('Failed to initialize audio:', error);
      }
    };

    // Try to initialize immediately (web only). On native WebView some devices are stricter,
    // so we wait for a user interaction to avoid boot-time audio issues.
    const isNative = (window as any).Capacitor?.isNativePlatform?.() || false;
    if (!isNative) {
      initializeAudio();
    }

    // Set up listeners for first user interaction
    const events = ['touchstart', 'click', 'keydown'];
    
    const handleFirstInteraction = () => {
      initializeAudio();
      // Remove listeners after first interaction
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };

    events.forEach(event => {
      document.addEventListener(event, handleFirstInteraction, { once: true });
    });

    // Show prompt after 2 seconds if not initialized
    const promptTimer = setTimeout(() => {
      if (!initialized) {
        setShowInitPrompt(true);
      }
    }, 2000);

    return () => {
      clearTimeout(promptTimer);
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };
  }, []);

  return { isAudioReady, showInitPrompt };
};
