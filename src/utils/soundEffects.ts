// Enhanced Sound Effect Manager with Web Audio API support
class SoundEffectManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;
  private initialized: boolean = false;
  private useWebAudio: boolean = true;

  constructor() {
    // Don't preload immediately - wait for user interaction
  }

  /**
   * Initialize audio system - must be called after user interaction
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔊 Initializing audio system...');

    try {
      // Try to create AudioContext (Web Audio API)
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.audioContext = new AudioContextClass();
        
        // Resume context if suspended (required on iOS)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        console.log('✅ Web Audio API initialized');
      }
    } catch (error) {
      console.warn('Web Audio API not available, falling back to HTML5 Audio:', error);
      this.useWebAudio = false;
    }

    // Preload sounds
    await this.preloadSounds();
    
    // Check kiosk sound settings
    await this.checkKioskSoundSettings();
    
    this.initialized = true;
    console.log('✅ Audio system ready');
  }

  private async preloadSounds(): Promise<void> {
    const soundFiles = {
      keypad: '/sounds/keypad-click.mp3',
      navigation: '/sounds/navigation.mp3',
      category: '/sounds/category-select.mp3',
    };

    const loadPromises = Object.entries(soundFiles).map(async ([key, path]) => {
      try {
        // Always create HTML5 Audio as fallback
        const audio = new Audio(path);
        audio.volume = this.volume;
        audio.preload = 'auto';
        
        // Wait for audio to be loaded
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', resolve, { once: true });
          audio.addEventListener('error', reject, { once: true });
          audio.load();
        });
        
        this.sounds.set(key, audio);
        console.log(`✅ Loaded audio: ${key}`);

        // If Web Audio is available, also load as buffer
        if (this.useWebAudio && this.audioContext) {
          try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(key, audioBuffer);
            console.log(`✅ Loaded Web Audio buffer: ${key}`);
          } catch (error) {
            console.warn(`Failed to load Web Audio buffer for ${key}:`, error);
          }
        }
      } catch (error) {
        console.error(`Failed to load sound ${key}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  private async checkKioskSoundSettings(): Promise<void> {
    try {
      const kioskId = localStorage.getItem('kiosk_id');
      if (!kioskId) {
        this.enabled = true;
        return;
      }

      const { loadKioskRuntimeConfig } = await import('@/lib/kioskConfig');
      const config = await loadKioskRuntimeConfig(kioskId);

      if (config) {
        this.enabled = config.sound_enabled !== false;
        console.log(`🔊 Sound ${this.enabled ? 'enabled' : 'disabled'} for kiosk`);
      }
    } catch (error) {
      console.error('Failed to load kiosk sound settings:', error);
      this.enabled = true;
    }
  }

  public async play(soundType: 'keypad' | 'navigation' | 'category'): Promise<void> {
    if (!this.initialized) {
      console.warn('Audio not initialized yet');
      return;
    }

    if (!this.enabled) {
      return;
    }

    // Try Web Audio API first (better for mobile)
    if (this.useWebAudio && this.audioContext && this.audioBuffers.has(soundType)) {
      try {
        const buffer = this.audioBuffers.get(soundType);
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = this.volume;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0);
        console.log(`🔊 Playing (Web Audio): ${soundType}`);
        return;
      } catch (error) {
        console.warn(`Web Audio playback failed for ${soundType}, falling back to HTML5:`, error);
      }
    }

    // Fallback to HTML5 Audio
    const audio = this.sounds.get(soundType);
    if (!audio) {
      console.warn(`Sound not found: ${soundType}`);
      return;
    }

    try {
      // Clone the audio to allow overlapping plays
      const audioClone = audio.cloneNode(true) as HTMLAudioElement;
      audioClone.volume = this.volume;
      await audioClone.play();
      console.log(`🔊 Playing (HTML5): ${soundType}`);
    } catch (error) {
      // Final fallback: try to play original audio
      try {
        audio.currentTime = 0;
        await audio.play();
      } catch (fallbackError) {
        console.error(`Failed to play sound ${soundType}:`, error);
      }
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🔊 Sound ${enabled ? 'enabled' : 'disabled'}`);
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(audio => {
      audio.volume = this.volume;
    });
  }

  public async refreshSettings(): Promise<void> {
    await this.checkKioskSoundSettings();
  }

  public isReady(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const soundManager = new SoundEffectManager();
