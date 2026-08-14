// Database models index file - exports all models for easy importing

// Database connection manager
export { db } from '../connection';

// User and Authentication
export { User, type IUser } from './User';
export { CharacterSession, type ICharacterSession } from './CharacterSession';

// Character System
export { Character, type ICharacter } from './Character';
export { Skill, SKILL_CATEGORY_LABELS, type ISkill } from './Skill';

// Location System
export { Location, type ILocation } from './Location';
export { Chat, type IChat } from './Chat';
export { ChatBackup } from './ChatBackup';
export { ChatScene, type IChatScene } from './ChatScene';
export { CharacterChatScene, type ICharacterChatScene } from './CharacterChatScene';
export { CharacterNotes, type ICharacterNotes } from './CharacterNotes';

// Combat & Confrontation System (TiroContrapposto)
export { SkillConfrontation, type ISkillConfrontation } from './SkillConfrontation';
export { CombatEncounter, type ICombatEncounter } from './CombatEncounter';

// Corporation System
// Deprecato: il model vive ora in features/corporazioni/models/Corporation.ts
// (Fase 4 del refactor layer→feature). Shim di compatibilità per chi importa
// ancora dal barrel — EconomyController.ts, CharacterSocialController.ts.
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  Corporation,
  CorporationMembershipRequest,
  CorporationInvitation,
  type ICorporation,
  type ICorporationMembershipRequest,
  type ICorporationInvitation
} from '@features/corporazioni/models/Corporation';

// Item and Shop System
export { 
  Item, 
  CharacterInventory,
  Shop,
  ShopItem,
  type IItem,
  type ICharacterInventory,
  type IShop,
  type IShopItem,
  ItemCategory,
  ITEM_CATEGORY_LABELS
} from './Item';

// Continuative Services System (VC-budget subscriptions: servitù, comunicazioni, trasporti, sicurezza)
// Deprecato: il model vive ora in features/economia/models/ (Fase 6.3 del
// refactor layer→feature). Shim di compatibilità per chi importa ancora dal barrel.
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  Service,
  type IService,
  ServiceCategory
} from '@features/economia/models/Service';

// OffGame Chat System (LEGACY - Group chats with admin roles)
// NOTE: This is the ORIGINAL system that coexists with the NEW OffGameThread system
// LEGACY system: Supports groups, admins, configurable retention
// NEW system: Simple 1-to-1 threads (see below)
// Both systems are in production during gradual migration
export {
  OffGameChat,
  type IOffGameChat
} from './OffGameChat';
export {
  OffGameChatMessage,
  type IOffGameChatMessage
} from './OffGameChatMessage';
export {
  OffGameChatParticipant,
  type IOffGameChatParticipant
} from './OffGameChatParticipant';

// OnGame Messages System (Victorian postal system)
export {
  OnGameMessage,
  type IOnGameMessage
} from './OnGameMessage';
// NOTE: OnGameMessageView model removed - view logic moved to controllers in new architecture

// New Dual Messaging Architecture (Thread-based)
export {
  OnGameThread,
  type IOnGameThread
} from './OnGameThread';
export {
  OffGameThread,
  type IOffGameThread
} from './OffGameThread';
export {
  OffGameMessage,
  type IOffGameMessage
} from './OffGameMessage';
export {
  MessageBackup,
  type IMessageBackup
} from './MessageBackup';

// Relationship System
export {
  CharacterRelation,
  CharacterRelationType,
  CharacterRelationProposal,
  CharacterRelationAction,
  type ICharacterRelationType,
  type ICharacterRelation,
  type ICharacterRelationProposal,
  type ICharacterRelationAction
} from './CharacterRelation';

// Occupation System
// Deprecato: i model vivono ora in features/occupazioni/models/ (Fase 6.2 del
// refactor layer→feature). Shim di compatibilità per chi importa ancora dal barrel.
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  Occupation,
  CharacterOccupationHistory,
  OccupationCategory,
  type IOccupation,
  type ICharacterOccupationHistory
} from '@features/occupazioni/models/Occupation';

// Ticketing System
// Deprecato: i model vivono ora in features/tickets/models/ (Fase 6.1 del
// refactor layer→feature). Shim di compatibilità per chi importa ancora dal barrel.
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  Ticket,
  type ITicket
} from '@features/tickets/models/Ticket';
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  TicketMessage,
  type ITicketMessage
} from '@features/tickets/models/TicketMessage';
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  TicketNotification,
  type TicketNotificationType,
  type ITicketNotification
} from '@features/tickets/models/TicketNotification';

// Financial System
// Deprecato: i model vivono ora in features/economia/models/ (Fase 6.3 del
// refactor layer→feature). Shim di compatibilità per chi importa ancora dal barrel.
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  SocialClassConfig,
  type ISocialClassConfig
} from '@features/economia/models/SocialClassConfig';
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6
export {
  CharacterFinances,
  type ICharacterFinances
} from '@features/economia/models/CharacterFinances';

// Location Property System
export {
  LocationProperty,
  type ILocationProperty
} from './LocationProperty';

// Session & Gaming System
export {
  CharacterProgression,
  type ICharacterProgression
} from './CharacterProgression';
export {
  GamingSession,
  type IGamingSession
} from './GamingSession';
export {
  SessionManagement,
  type ISessionManagement
} from './SessionManagement';
export {
  SessionTemplate,
  type ISessionTemplate
} from './SessionTemplate';

// System Configuration
export {
  SystemConfiguration,
  type ISystemConfiguration
} from './SystemConfiguration';

// Broadcast Messages
export {
  BroadcastMessage,
  type IBroadcastMessage
} from './BroadcastMessage';

// WebSocket Event Replay
export {
  WebSocketEvent,
  type IWebSocketEvent
} from './WebSocketEvent';

// Audit Logging System
export {
  AuditLog,
  type IAuditLog,
  type IAuditLogActor,
  type IAuditLogTarget
} from './AuditLog';

// Chat Moderation System
export { ChatModerationAction, type IChatModerationAction } from './ChatModerationAction';
export { MessageReport, type IMessageReport } from './MessageReport';
export { UserReport, type IUserReport } from './UserReport';
export { ModerationAlert, type IModerationAlert } from './ModerationAlert';

// Knowledge Base System (Documents + SubTypes)
export {
  default as DocumentSubtype,
  type IDocumentSubtype,
  type DocumentType
} from './DocumentSubtype';
export {
  default as Document,
  type IDocument
} from './Document';
export {
  default as DocumentChunk,
  type IDocumentChunk
} from './DocumentChunk';

// Forum System
export { ForumCategory, type IForumCategory } from './ForumCategory';
export { ForumTopic, type IForumTopic } from './ForumTopic';
export { ForumTopicPermissionOverride, type IForumTopicPermissionOverride, type ForumPermissionDecision, type ForumTopicPermissionOverrides } from './ForumTopicPermissionOverride';
export { ForumDiscussion, type IForumDiscussion } from './ForumDiscussion';
export { ForumPost, type IForumPost } from './ForumPost';
export { ForumTopicFavorite, type IForumTopicFavorite } from './ForumTopicFavorite';
export { ForumDiscussionFavorite, type IForumDiscussionFavorite } from './ForumDiscussionFavorite';
export { ForumDiscussionSubscription, type IForumDiscussionSubscription } from './ForumDiscussionSubscription';
export { ForumBookmark, BookmarkItemType, type IForumBookmark } from './ForumBookmark';
export { ForumNotification, ForumNotificationType, type IForumNotification } from './ForumNotification';
export { ForumCharacterPreference, type IForumCharacterPreference, type ForumReplyOrder } from './ForumCharacterPreference';
export { ForumTopicReadState, type IForumTopicReadState } from './ForumTopicReadState';

// Deleted Records Archive
export { DeletedRecord, type IDeletedRecord } from './DeletedRecord';

// Soft Delete Registry - register all soft-deletable models
import { registerSoftDeleteModel } from '../plugins/softDeleteRegistry';
registerSoftDeleteModel('characters', () => require('./Character').Character, 'name');
registerSoftDeleteModel('locations', () => require('./Location').Location, 'name');
registerSoftDeleteModel('items', () => require('./Item').Item, 'name');
registerSoftDeleteModel('documents', () => require('./Document').default, 'title');
registerSoftDeleteModel('users', () => require('./User').User, 'username');
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6 — require() non è visto da check-boundaries.ts, aggiornare a mano se il path cambia ancora
registerSoftDeleteModel('occupations', () => require('@features/occupazioni/models/Occupation').Occupation, 'name');
registerSoftDeleteModel('skills', () => require('./Skill').Skill, 'name');
// boundary-allow: shim di migrazione previsto dal piano, rimosso alla Fase 6 — require() non è visto da check-boundaries.ts, aggiornare a mano se il path cambia ancora
registerSoftDeleteModel('socialclassconfigs', () => require('@features/economia/models/SocialClassConfig').SocialClassConfig, 'label');
