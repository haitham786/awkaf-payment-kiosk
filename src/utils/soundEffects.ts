// Sound effect manager for kiosk interactions
class SoundEffectManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    this.preloadSounds();
    this.checkKioskSoundSettings();
  }

  private preloadSounds() {
    const soundFiles = {
      keypad: '/sounds/keypad-click.mp3',
      navigation: '/sounds/navigation.mp3',
      category: '/sounds/category-select.mp3',
    };

    Object.entries(soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.volume = this.volume;
      audio.preload = 'auto';
      audio.load(); // Explicitly load the audio
      this.sounds.set(key, audio);
    });
  }

  private async checkKioskSoundSettings() {
    try {
      const kioskId = localStorage.getItem('kiosk_id');
      if (!kioskId) {
        this.enabled = true; // Default enabled for non-kiosk users
        return;
      }

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('kiosks')
        .select('configuration')
        .eq('id', kioskId)
        .single();

      if (!error && data?.configuration) {
        const config = data.configuration as any;
        this.enabled = config.sound_enabled !== false; // Default to true if not set
      }
    } catch (error) {
      console.error('Failed to load kiosk sound settings:', error);
      this.enabled = true; // Default enabled on error
    }
  }

  public async play(soundType: 'keypad' | 'navigation' | 'category') {
    if (!this.enabled) return;

    const audio = this.sounds.get(soundType);
    if (!audio) return;

    try {
      // Clone the audio to allow overlapping plays
      const audioClone = audio.cloneNode(true) as HTMLAudioElement;
      audioClone.volume = this.volume;
      await audioClone.play();
    } catch (error) {
      // Fallback: try to play original audio
      try {
        audio.currentTime = 0;
        await audio.play();
      } catch (fallbackError) {
        console.error('Failed to play sound:', error);
      }
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(audio => {
      audio.volume = this.volume;
    });
  }

  public async refreshSettings() {
    await this.checkKioskSoundSettings();
  }
}

// Export singleton instance
export const soundManager = new SoundEffectManager();
