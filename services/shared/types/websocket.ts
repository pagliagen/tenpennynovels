// Import types for use in this file
import type { 
  LocationChatMessage,
  InGameMessage
} from './messaging';

// Re-export from messaging.ts for backward compatibility
export type { 
  LocationChatMessage as ChatMessage,
  LocationMessageType,
  DiceRollResult,
  SkillCheckResult,
  LocationActionItemUsage,
  InGameMessage,
  OffGameMessage
} from './messaging';

// Legacy interface - use DiceRollResult from messaging.ts for new code
export interface DiceResult {
  type: 'd100' | 'd10' | 'd6' | 'd4' | 'd3';
  result: number;
  skillName?: string;
  difficulty?: 'easy' | 'normal' | 'hard' | 'extreme';
  success: boolean;
  criticalSuccess?: boolean;
  fumble?: boolean;
}

export interface LocationJoinEvent {
  type: 'location_join';
  locationId: string;
  character: {
    id: string;
    name: string;
    occupation: string;
  };
  timestamp: Date;
}

export interface LocationLeaveEvent {
  type: 'location_leave';
  locationId: string;
  characterId: string;
  characterName: string;
  timestamp: Date;
}

// WebSocket events
export interface ClientToServerEvents {
  join_location: (locationId: string) => void;
  leave_location: (locationId: string) => void;
  send_chat_message: (message: Omit<LocationChatMessage, 'id' | 'timestamp'>) => void;
  send_whisper: (targetCharacterId: string, content: string) => void;
  roll_dice: (skillName: string, difficulty?: string) => void;
  send_in_game_message: (message: Omit<InGameMessage, 'id' | 'sentAt' | 'isDelivered' | 'deliveredAt' | 'isRead' | 'readAt'>) => void;
  typing_start: (locationId: string) => void;
  typing_stop: (locationId: string) => void;
}

export interface ServerToClientEvents {
  chat_message: (message: LocationChatMessage) => void;
  location_occupants: (occupants: LocationOccupant[]) => void;
  location_joined: (event: LocationJoinEvent) => void;
  location_left: (event: LocationLeaveEvent) => void;
  dice_result: (result: DiceResult & { characterName: string }) => void;
  in_game_message_received: (message: InGameMessage) => void;
  typing_indicator: (characterName: string, isTyping: boolean) => void;
  system_notification: (message: string) => void;
  error: (error: string) => void;
}

export interface LocationOccupant {
  characterId: string;
  characterName: string;
  occupation: string;
  joinedAt: Date;
}