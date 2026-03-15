import { logger } from '../logger';
import { ConfigurationService } from '@shared/services/ConfigurationService';

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
  private config: PostalSystemConfig | null = null;
  private configService: ConfigurationService;
  private configLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    // Import redis client dynamically to avoid circular dependencies
    const { redisClient } = require('@config/runtime/redis');
    this.configService = new ConfigurationService(redisClient, logger);
    // Do NOT call loadConfig() here - it will be called lazily on first use
  }

  /**
   * Ensure config is loaded (lazy loading with singleton pattern)
   */
  private async ensureConfigLoaded(): Promise<void> {
    if (this.configLoaded && this.config) return;

    // If already loading, wait for that promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Start loading
    this.loadingPromise = this.loadConfig();
    await this.loadingPromise;
    this.loadingPromise = null;
  }

  private async loadConfig(): Promise<void> {
    try {
      // Fetch all postal_system configs from SystemConfiguration DB (Redis-cached)
      const configs = await this.configService.getConfigsBySection('postal_system');

      // Reconstruct messageTypes object
      const messageTypes: Record<string, MessageTypeConfig> = {
        note: configs['postal_message_type_note'],
        telegram: configs['postal_message_type_telegram'],
        letter: configs['postal_message_type_letter'],
        express_letter: configs['postal_message_type_express_letter'],
        postcard: configs['postal_message_type_postcard'],
        invitation: configs['postal_message_type_invitation'],
        official_document: configs['postal_message_type_official_document'],
        diary: configs['postal_message_type_diary'],
      };

      // Reconstruct settings object
      const settings = {
        defaultTimezone: configs['postal_settings_default_timezone'] || 'Europe/Rome',
        maxMessagesPerDay: configs['postal_settings_max_messages_per_day'] || 50,
        maxActiveMessagesInTransit: configs['postal_settings_max_active_in_transit'] || 20,
        cronJobIntervals: configs['postal_settings_cron_intervals'] || {},
        expressSurcharge: configs['postal_settings_express_surcharge'] || { enabled: false, multiplierRange: [1, 1] },
        residenceSystem: configs['postal_settings_residence_system'] || {
          requiresDiscovery: true,
          allowsPublicDirectory: false,
          unknownAddressFee: 1,
        },
      };

      this.config = { messageTypes, settings };
      this.configLoaded = true;
      logger.info('Postal system configuration loaded from DB successfully');
    } catch (error: any) {
      logger.error('Failed to load postal system configuration', { error: error.message });
      throw error;
    }
  }

  public async getMessageType(messageType: string): Promise<MessageTypeConfig | null> {
    await this.ensureConfigLoaded();
    return this.config!.messageTypes[messageType] || null;
  }

  public async getAllMessageTypes(): Promise<Record<string, MessageTypeConfig>> {
    await this.ensureConfigLoaded();
    return this.config!.messageTypes;
  }

  public async getAvailableMessageTypes(characterRoles: string[]): Promise<Record<string, MessageTypeConfig>> {
    await this.ensureConfigLoaded();
    const available: Record<string, MessageTypeConfig> = {};

    for (const [key, config] of Object.entries(this.config!.messageTypes)) {
      // Check if character has required roles
      const hasRequiredRole = config.availableToRoles.some(role => characterRoles.includes(role));
      if (hasRequiredRole) {
        available[key] = config;
      }
    }

    return available;
  }

  public async calculateDeliveryTime(messageType: string, isExpress: boolean = false): Promise<Date | null> {
    const config = await this.getMessageType(messageType);
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

  public async calculatePostage(messageType: string, isExpress: boolean = false): Promise<number> {
    const config = await this.getMessageType(messageType);
    if (!config) return 0;

    let cost = config.postageRequired;
    
    if (isExpress && config.expressCostMultiplier) {
      cost *= config.expressCostMultiplier;
    }
    
    return cost;
  }

  public async validateMessage(messageType: string, content: string, characterRoles: string[], recipients?: string[]): Promise<{
    valid: boolean;
    error?: string;
  }> {
    const config = await this.getMessageType(messageType);
    
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

  public async canSendToResidence(messageType: string): Promise<boolean> {
    const config = await this.getMessageType(messageType);
    if (!config) return false;

    return config.deliveryMethod === 'to_residence' || config.deliveryMethod === 'both_options';
  }

  public async canSendToPerson(messageType: string): Promise<boolean> {
    const config = await this.getMessageType(messageType);
    if (!config) return false;

    return config.deliveryMethod === 'to_person' || config.deliveryMethod === 'both_options';
  }

  public async requiresResidenceKnowledge(messageType: string): Promise<boolean> {
    const config = await this.getMessageType(messageType);
    return config?.requiresResidenceKnowledge || false;
  }

  public async getSettings() {
    await this.ensureConfigLoaded();
    return this.config!.settings;
  }

  // Reload configuration (useful for runtime updates)
  public async reloadConfig(): Promise<void> {
    this.configLoaded = false;
    this.config = null;
    await this.loadConfig();
  }
}

// Singleton instance
export const postalSystem = new PostalSystem();
export type { MessageTypeConfig, PostalSystemConfig };