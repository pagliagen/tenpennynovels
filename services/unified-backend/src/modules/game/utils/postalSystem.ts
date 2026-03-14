import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

interface MessageTypeConfig {
  displayName: string;
  description: string;
  deliveryMode: 'realtime' | 'scheduled_fixed' | 'scheduled_variable' | 'daily_batch' | 'messenger_boy' | 'no_delivery';
  deliveryTiming?: {
    immediate?: boolean;
    fixedDelayMinutes?: number;
    variableDelayRange?: { min: number; max: number };
    dailyDeliveryTimes?: string[];
  };
  deliveryMethod: 'to_person' | 'to_residence' | 'both_options' | 'self_only';
  requiresResidenceKnowledge: boolean;
  postageRequired: number;
  expressCostMultiplier?: number;
  maxLength: number;
  requiresSealing: boolean;
  allowsReply: boolean;
  visibilityInPreview: 'none' | 'subject_only' | 'first_line';
  availableToRoles: string[];
  restrictedLocations: string[];
  icon: string;
  allowMultipleRecipients: boolean;
  maxRecipients: number;
}

interface PostalSystemConfig {
  messageTypes: Record<string, MessageTypeConfig>;
  settings: {
    defaultTimezone: string;
    maxMessagesPerDay: number;
    maxActiveMessagesInTransit: number;
    cronJobIntervals: Record<string, string>;
    expressSurcharge: {
      enabled: boolean;
      multiplierRange: number[];
    };
    residenceSystem: {
      requiresDiscovery: boolean;
      allowsPublicDirectory: boolean;
      unknownAddressFee: number;
    };
  };
}

class PostalSystem {
  private config!: PostalSystemConfig;
  private configPath: string;

  constructor() {
    // Path to config - works with build script that copies assets to dist/config
    this.configPath = path.join(__dirname, '../../../config/static/postal-system.json');
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      logger.info('Postal system configuration loaded successfully');
    } catch (error: any) {
      logger.error('Failed to load postal system configuration:', error);
      throw new Error('Could not load postal system configuration');
    }
  }

  public getMessageType(messageType: string): MessageTypeConfig | null {
    return this.config.messageTypes[messageType] || null;
  }

  public getAllMessageTypes(): Record<string, MessageTypeConfig> {
    return this.config.messageTypes;
  }

  public getAvailableMessageTypes(characterRoles: string[]): Record<string, MessageTypeConfig> {
    const available: Record<string, MessageTypeConfig> = {};
    
    for (const [key, config] of Object.entries(this.config.messageTypes)) {
      // Check if character has required roles
      const hasRequiredRole = config.availableToRoles.some(role => characterRoles.includes(role));
      if (hasRequiredRole) {
        available[key] = config;
      }
    }
    
    return available;
  }

  public calculateDeliveryTime(messageType: string, isExpress: boolean = false): Date | null {
    const config = this.getMessageType(messageType);
    if (!config || !config.deliveryTiming) return null;

    const now = new Date();
    let deliveryDate = new Date(now);

    switch (config.deliveryMode) {
      case 'realtime':
        return now; // Immediate delivery
      
      case 'scheduled_fixed':
        if (config.deliveryTiming.fixedDelayMinutes) {
          let delay = config.deliveryTiming.fixedDelayMinutes;
          if (isExpress && config.expressCostMultiplier) {
            delay = Math.floor(delay / config.expressCostMultiplier);
          }
          deliveryDate.setMinutes(deliveryDate.getMinutes() + delay);
        }
        break;
      
      case 'scheduled_variable':
        if (config.deliveryTiming.variableDelayRange) {
          const { min, max } = config.deliveryTiming.variableDelayRange;
          let delay = min + Math.random() * (max - min);
          if (isExpress && config.expressCostMultiplier) {
            delay = Math.floor(delay / config.expressCostMultiplier);
          }
          deliveryDate.setMinutes(deliveryDate.getMinutes() + delay);
        }
        break;
      
      case 'messenger_boy':
        if (config.deliveryTiming.variableDelayRange) {
          const { min, max } = config.deliveryTiming.variableDelayRange;
          const delay = min + Math.random() * (max - min);
          deliveryDate.setMinutes(deliveryDate.getMinutes() + delay);
        }
        break;
      
      case 'daily_batch':
        if (config.deliveryTiming.dailyDeliveryTimes) {
          const deliveryTimes = config.deliveryTiming.dailyDeliveryTimes;
          const currentTime = now.getHours() * 60 + now.getMinutes();
          
          // Find next delivery time today
          for (const timeStr of deliveryTimes) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const deliveryMinutes = hours * 60 + minutes;
            
            if (deliveryMinutes > currentTime) {
              deliveryDate.setHours(hours, minutes, 0, 0);
              if (isExpress && config.expressCostMultiplier) {
                // Express can move to next batch sooner
                const expressAdvance = Math.floor((deliveryMinutes - currentTime) / config.expressCostMultiplier);
                deliveryDate.setMinutes(deliveryDate.getMinutes() - expressAdvance);
              }
              return deliveryDate;
            }
          }
          
          // No delivery time left today, use first time tomorrow
          const [hours, minutes] = deliveryTimes[0].split(':').map(Number);
          deliveryDate.setDate(deliveryDate.getDate() + 1);
          deliveryDate.setHours(hours, minutes, 0, 0);
        }
        break;
      
      case 'no_delivery':
        return null; // Diary entries, no delivery needed
        
      default:
        logger.warn(`Unknown delivery mode: ${config.deliveryMode}`);
        return null;
    }

    return deliveryDate;
  }

  public calculatePostage(messageType: string, isExpress: boolean = false): number {
    const config = this.getMessageType(messageType);
    if (!config) return 0;

    let cost = config.postageRequired;
    
    if (isExpress && config.expressCostMultiplier) {
      cost *= config.expressCostMultiplier;
    }
    
    return cost;
  }

  public validateMessage(messageType: string, content: string, characterRoles: string[], recipients?: string[]): {
    valid: boolean;
    error?: string;
  } {
    const config = this.getMessageType(messageType);
    
    if (!config) {
      return { valid: false, error: 'Tipo di messaggio non valido' };
    }

    // Check role permissions
    const hasRequiredRole = config.availableToRoles.some(role => characterRoles.includes(role));
    if (!hasRequiredRole) {
      return { valid: false, error: 'Permessi insufficienti per questo tipo di messaggio' };
    }

    // Check content length
    if (content.length > config.maxLength) {
      return { valid: false, error: `Messaggio troppo lungo (max ${config.maxLength} caratteri)` };
    }

    // Check recipients count
    if (recipients && recipients.length > 0) {
      if (!config.allowMultipleRecipients && recipients.length > 1) {
        return { valid: false, error: 'Questo tipo di messaggio non consente più destinatari' };
      }
      
      if (recipients.length > config.maxRecipients) {
        return { valid: false, error: `Troppi destinatari (max ${config.maxRecipients})` };
      }
    }

    return { valid: true };
  }

  public canSendToResidence(messageType: string): boolean {
    const config = this.getMessageType(messageType);
    if (!config) return false;
    
    return config.deliveryMethod === 'to_residence' || config.deliveryMethod === 'both_options';
  }

  public canSendToPerson(messageType: string): boolean {
    const config = this.getMessageType(messageType);
    if (!config) return false;
    
    return config.deliveryMethod === 'to_person' || config.deliveryMethod === 'both_options';
  }

  public requiresResidenceKnowledge(messageType: string): boolean {
    const config = this.getMessageType(messageType);
    return config?.requiresResidenceKnowledge || false;
  }

  public getSettings() {
    return this.config.settings;
  }

  // Reload configuration (useful for runtime updates)
  public reloadConfig(): void {
    this.loadConfig();
  }
}

// Singleton instance
export const postalSystem = new PostalSystem();
export type { MessageTypeConfig, PostalSystemConfig };