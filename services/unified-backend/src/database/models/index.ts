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
export { CharacterNotes, type ICharacterNotes } from './CharacterNotes';

// Corporation System
export { 
  Corporation, 
  CorporationMembershipRequest,
  CorporationInvitation,
  type ICorporation,
  type ICorporationMembershipRequest,
  type ICorporationInvitation 
} from './Corporation';

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

// OffGame Chat System (character-to-character OOC)
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
export {
  OnGameMessageView,
  type IOnGameMessageView
} from './OnGameMessageView';

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
export {
  Occupation,
  CharacterOccupationHistory,
  OccupationCategory,
  type IOccupation,
  type ICharacterOccupationHistory
} from './Occupation';

// Ticketing System
export {
  Ticket,
  type ITicket
} from './Ticket';
export {
  TicketMessage,
  type ITicketMessage
} from './TicketMessage';
export {
  TicketNotification,
  type TicketNotificationType,
  type ITicketNotification
} from './TicketNotification';

// Financial System
export {
  SocialClassConfig,
  type ISocialClassConfig
} from './SocialClassConfig';
export {
  CharacterFinances,
  type ICharacterFinances
} from './CharacterFinances';

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
export { ForumTopic, type IForumTopic } from './ForumTopic';
export { ForumDiscussion, type IForumDiscussion } from './ForumDiscussion';
export { ForumPost, type IForumPost } from './ForumPost';
export { ForumTopicFavorite, type IForumTopicFavorite } from './ForumTopicFavorite';
export { ForumDiscussionSubscription, type IForumDiscussionSubscription } from './ForumDiscussionSubscription';
export { ForumCharacterFollow, type IForumCharacterFollow } from './ForumCharacterFollow';
export { ForumBookmark, BookmarkItemType, type IForumBookmark } from './ForumBookmark';
export { ForumReaction, ReactionType, type IForumReaction } from './ForumReaction';
export { ForumNotification, ForumNotificationType, type IForumNotification } from './ForumNotification';

// Deleted Records Archive
export { DeletedRecord, type IDeletedRecord } from './DeletedRecord';

// Soft Delete Registry - register all soft-deletable models
import { registerSoftDeleteModel } from '../plugins/softDeleteRegistry';
registerSoftDeleteModel('characters', () => require('./Character').Character, 'name');
registerSoftDeleteModel('locations', () => require('./Location').Location, 'name');
registerSoftDeleteModel('items', () => require('./Item').Item, 'name');
registerSoftDeleteModel('documents', () => require('./Document').default, 'title');
registerSoftDeleteModel('users', () => require('./User').User, 'username');
registerSoftDeleteModel('occupations', () => require('./Occupation').Occupation, 'name');
registerSoftDeleteModel('skills', () => require('./Skill').Skill, 'name');
registerSoftDeleteModel('socialclassconfigs', () => require('./SocialClassConfig').SocialClassConfig, 'label');
