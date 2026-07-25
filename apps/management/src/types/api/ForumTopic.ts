export type AccessRuleType = 'public' | 'authenticated' | 'corporation' | 'gameplayRole';

export interface TopicAccessRule {
  type: AccessRuleType;
  corporationId?: string;
  gameplayRole?: string;
  label?: string;
}

export type ForumTopicMode = 'ON' | 'OFF';

export interface ForumTopic {
  _id: string;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  accessRules: TopicAccessRule[];
  isVisible: boolean;
  isLocked: boolean;
  isPinned: boolean;
  discussionCount: number;
  postCount: number;
  lastPostAt?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  categoryId?: string;
  categorySlug?: string;
  accessRulesOverride?: boolean;
  mode: ForumTopicMode;
}

export interface ForumTopicListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateForumTopicData {
  title: string;
  description?: string;
  sortOrder?: number;
  accessRules?: TopicAccessRule[];
  color?: string;
  icon?: string;
  mode?: ForumTopicMode;
}

export interface UpdateForumTopicData extends Partial<CreateForumTopicData> {
  isVisible?: boolean;
  isLocked?: boolean;
  isPinned?: boolean;
}

export interface ForumTopicListResponse {
  result: boolean;
  list: ForumTopic[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const ACCESS_RULE_TYPE_LABELS: Record<AccessRuleType, string> = {
  public: 'Pubblico',
  authenticated: 'Autenticato',
  corporation: 'Corporazione',
  gameplayRole: 'Ruolo di Gioco',
};

export const GAMEPLAY_ROLE_OPTIONS = [
  { value: 'player', label: 'Giocatore' },
  { value: 'master', label: 'Master' },
  { value: 'moderatore', label: 'Moderatore' },
];
