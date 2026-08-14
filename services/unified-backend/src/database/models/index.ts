// Database models index file - exports all models for easy importing

// Database connection manager
export { db } from '../connection';

// User and Authentication: spostati in core/auth/models/ (Fase 7.1)

// Character System
export { Character, type ICharacter } from './Character';
export { Skill, SKILL_CATEGORY_LABELS, type ISkill } from './Skill';

// Location System
export { Location, type ILocation } from './Location';
export { Chat, type IChat } from './Chat';
export { ChatBackup } from './ChatBackup';
export { CharacterNotes, type ICharacterNotes } from './CharacterNotes';

// Combat & Confrontation System (TiroContrapposto)
export { SkillConfrontation, type ISkillConfrontation } from './SkillConfrontation';
export { CombatEncounter, type ICombatEncounter } from './CombatEncounter';

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

// Deleted Records Archive
export { DeletedRecord, type IDeletedRecord } from './DeletedRecord';

// Soft Delete Registry - register all soft-deletable models
//
// I model delle feature migrate (oggetti, documenti, occupazioni, economia)
// restano qui sotto con un require() diretto verso features/<nome>/models/
// — non uno shim in via di rimozione, ma un'annotazione permanente:
// check-boundaries.ts non vede require(), va aggiornata a mano se il path
// della feature cambia ancora.
import { registerSoftDeleteModel } from '../plugins/softDeleteRegistry';
registerSoftDeleteModel('characters', () => require('./Character').Character, 'name');
registerSoftDeleteModel('locations', () => require('./Location').Location, 'name');
// boundary-allow: registro require()-based, non visto da check-boundaries.ts
registerSoftDeleteModel('items', () => require('@features/oggetti/models/Item').Item, 'name');
// boundary-allow: registro require()-based, non visto da check-boundaries.ts
registerSoftDeleteModel('documents', () => require('@features/documenti/models/Document').default, 'title');
registerSoftDeleteModel('users', () => require('@core/auth/models/User').User, 'username');
// boundary-allow: registro require()-based, non visto da check-boundaries.ts
registerSoftDeleteModel('occupations', () => require('@features/occupazioni/models/Occupation').Occupation, 'name');
registerSoftDeleteModel('skills', () => require('./Skill').Skill, 'name');
// boundary-allow: registro require()-based, non visto da check-boundaries.ts
registerSoftDeleteModel('socialclassconfigs', () => require('@features/economia/models/SocialClassConfig').SocialClassConfig, 'label');
