// Audio files available for notifications
export interface AudioFile {
  id: string;
  name: string;
  path: string;
  description: string;
}

export const AVAILABLE_AUDIO_FILES: AudioFile[] = [
  {
    id: 'notification-001',
    name: 'Suono 1',
    path: '/audio/new-notification-001.mp3',
    description: 'Suono di notifica classico'
  },
  {
    id: 'notification-002', 
    name: 'Suono 2',
    path: '/audio/new-notification-002.mp3',
    description: 'Suono di notifica alternativo'
  },
  {
    id: 'none',
    name: 'Nessun suono',
    path: '',
    description: 'Disabilita audio per questo tipo'
  }
];

// Default audio assignments per notification type
export const DEFAULT_AUDIO_ASSIGNMENTS: Record<string, string> = {
  'chat_message': 'notification-001',
  'ingame_message': 'notification-002', 
  'offgame_message': 'notification-001',
  'character_approved': 'notification-002',
  'character_rejected': 'notification-001',
  'player_entered': 'none', // Presence notifications typically don't need sound
  'system_message': 'notification-002'
};

// Helper function to get audio file by ID
export const getAudioFileById = (id: string): AudioFile | undefined => {
  return AVAILABLE_AUDIO_FILES.find(file => file.id === id);
};

// Helper function to play audio file
export const playAudioFile = (audioId: string, volume: number = 0.5): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audioFile = getAudioFileById(audioId);
    
    if (!audioFile || audioFile.path === '') {
      resolve(); // No audio to play
      return;
    }

    try {
      const audio = new Audio(audioFile.path);
      audio.volume = Math.max(0, Math.min(1, volume)); // Clamp volume between 0 and 1
      
      audio.addEventListener('ended', () => resolve());
      audio.addEventListener('error', (e) => reject(e));
      
      audio.play().catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};