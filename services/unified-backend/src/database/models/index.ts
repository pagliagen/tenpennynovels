// Database models index file - exports all models for easy importing

// Database connection manager
export { db } from '../connection';

// User and Authentication: spostati in core/auth/models/ (Fase 7.1)

// Character: spostato in core/character/models/ (Fase 7.2)
export { Skill, SKILL_CATEGORY_LABELS, type ISkill } from './Skill';

// Location: spostata in core/location/models/ (Fase 7.3)
// Chat, ChatBackup, OnGameMessage, OnGameThread, MessageBackup: spostati in core/chat/models/ (Fase 7.4)
export { CharacterNotes, type ICharacterNotes } from './CharacterNotes';

// Combat & Confrontation System (TiroContrapposto): spostati in features/confronti/models/

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
registerSoftDeleteModel('characters', () => require('@core/character/models/Character').Character, 'name');
registerSoftDeleteModel('locations', () => require('@core/location/models/Location').Location, 'name');
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
