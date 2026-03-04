// Database models index file - exports all models for easy importing

// Database connection manager
export { db } from '../connection';

// User and Authentication
export { User, type IUser } from './User';
export { CharacterSession, type ICharacterSession } from './CharacterSession';

// Character System
export { Character, type ICharacter } from './Character';
export { BackgroundQuestion, type IBackgroundQuestion } from './BackgroundQuestion';
export { Skill, type ISkill } from './Skill';

// Location System
export { Location, type ILocation } from './Location';
export { LocationAction, type ILocationAction } from './LocationAction';
export { LocationTag, type ILocationTag } from './LocationTag';
export { BlockNotes, type IBlockNotes } from './BlockNotes';

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
  ItemCategory
} from './Item';

// Economy System
export { 
  CharacterWallet,
  Transaction,
  EconomicReport,
  type ICharacterWallet,
  type ITransaction,
  type IEconomicReport
} from './Economy';

// Messaging System (OnGame messages)
export {
  InGameMessage,
  MessageInboxEntry,
  MessageOutboxEntry,
  MessageFolder,
  MessageLabel,
  LocationChatMessage,
  type IInGameMessage,
  type IMessageInboxEntry,
  type IMessageOutboxEntry,
  type IMessageFolder,
  type IMessageLabel,
  type ILocationChatMessage,
  VictorianMessageType,
  VictorianDeliveryMethod,
  LocationMessageType
} from './Messaging';

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
  RelationshipType,
  CharacterRelationship,
  RelationshipProposal,
  RelationshipAction,
  type IRelationshipType,
  type ICharacterRelationship,
  type IRelationshipProposal,
  type IRelationshipAction
} from './Relationship';

// Occupation System
export {
  Occupation,
  CharacterOccupationHistory,
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

// Financial System
export {
  SocialClassConfig,
  type ISocialClassConfig
} from './SocialClassConfig';
export {
  CharacterFinances,
  type ICharacterFinances
} from './CharacterFinances';
export {
  FinancialTransaction,
  type IFinancialTransaction,
  type TransactionType
} from './FinancialTransaction';

// Housing System
export {
  HousingProperty,
  type IHousingProperty
} from './HousingProperty';
export {
  EstateTransaction,
  type IEstateTransaction
} from './EstateTransaction';

// Experience Points System
export {
  ExperienceGrant,
  type IExperienceGrant
} from './ExperienceGrant';
export {
  CharacterProgression,
  type ICharacterProgression
} from './CharacterProgression';
export {
  GamingSession,
  type IGamingSession
} from './GamingSession';
export {
  Campaign,
  type ICampaign
} from './Campaign';

// System Configuration
export {
  SystemConfiguration,
  type ISystemConfiguration
} from './SystemConfiguration';

// WebSocket Event Replay (SPRINT 4)
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

// Knowledge Base System (Documents - NEW DUAL-TABLE)
export {
  default as Route,
  type IRoute,
  type RouteType,
  type RouteKind
} from './Route';
export {
  default as Document,
  type IDocument
} from './Document';

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
