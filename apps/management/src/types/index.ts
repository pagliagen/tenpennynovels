// =============================================================================
// TypeScript Type Definitions - Management Panel
// =============================================================================

import type { AuthContext as AuthContextType } from '@/lib/auth';

// Re-export auth types
export type {
  User,
  Character,
  AuthContext,
} from '@/lib/auth';

// Re-export API types
export type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  UpdateUserData,
  ApproveCharacterData,
  RejectCharacterData,
  TransactionData,
} from '@/lib/api';

// Re-export WebSocket types
export type {
  Notification,
  AdminNotification,
  SystemMetrics,
  WebSocketEvents,
  UseAdminWebSocketReturn,
} from '@/lib/websocket';

// =============================================================================
// Component Props Types
// =============================================================================

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface PageProps {
  authContext: AuthContextType;
}

// =============================================================================
// Data Table Types
// =============================================================================

export interface Column<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableAction<T = any> {
  label: string;
  icon: string;
  onClick: (item: T) => void;
  visible?: (item: T) => boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: (item: T) => boolean;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface BulkAction<T = any> {
  label: string;
  icon: string;
  onClick: (selectedItems: T[]) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  requireConfirmation?: boolean;
  confirmationMessage?: string;
}

// =============================================================================
// Form Types
// =============================================================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'datetime' | 'file';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
  defaultValue?: any;
  description?: string;
  className?: string;
}

export interface FormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  initialValues?: Record<string, any>;
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  className?: string;
}

// =============================================================================
// Modal Types
// =============================================================================

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscapeKey?: boolean;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DashboardStat {
  id: string;
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: string;
  color: string;
  description?: string;
  actionUrl?: string;
  requiredRoles?: string[];
}

export interface DashboardActivity {
  id: string;
  type: 'user-registered' | 'character-approved' | 'character-rejected' | 'content-created' | 'system-alert';
  title: string;
  description: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
  characterId?: string;
  characterName?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  services: {
    [key: string]: {
      status: 'online' | 'offline' | 'degraded';
      responseTime?: number;
      lastCheck: Date;
      message?: string;
    };
  };
  database: {
    status: 'connected' | 'disconnected' | 'slow';
    connections: number;
    responseTime: number;
  };
  redis: {
    status: 'connected' | 'disconnected' | 'slow';
    connections: number;
    memory: number;
  };
  server: {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
  };
}

// =============================================================================
// Status Types
// =============================================================================

export type CharacterStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'deleted';
export type UserStatus = 'active' | 'inactive' | 'banned' | 'suspended';
export type DocumentStatus = 'draft' | 'published' | 'archived' | 'deleted';
export type DocumentType = 'ambientazione' | 'regolamento';
export type DocumentVisibility = 'pubblico' | 'ristretto' | 'spento';
export type PostStatus = 'published' | 'hidden' | 'reported' | 'deleted';

export type AdminRole = 'gestore' | 'admin' | 'master' | 'moderatore';
export type GameplayRole = 'personaggio' | 'master' | 'moderatore' | 'gestore';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

// =============================================================================
// Filter Types
// =============================================================================

export interface FilterOption {
  label: string;
  value: any;
  count?: number;
}

export interface Filter {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'date-range' | 'number-range' | 'text';
  options?: FilterOption[];
  defaultValue?: any;
  placeholder?: string;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: any;
  displayValue: string;
}

// =============================================================================
// Export Types
// =============================================================================

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  filename?: string;
  columns?: string[];
  includeFilters?: boolean;
  includeHeaders?: boolean;
}

// =============================================================================
// Utility Types
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// =============================================================================
// Event Types
// =============================================================================

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: 'user' | 'character' | 'document' | 'post' | 'system';
  targetId?: string;
  changes?: Record<string, { old: any; new: any }>;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// Document Management Types
// =============================================================================

export interface DocumentGroup {
  id: string;
  name: string;
  description?: string;
  type: DocumentType;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  groupId: string;
  group?: DocumentGroup;
  type: DocumentType;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  order: number;
  slug?: string;
  summary?: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  lastEditedBy?: string;
  version: number;
}

export interface CreateDocumentData {
  title: string;
  content: string;
  groupId: string;
  type: DocumentType;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  summary?: string;
  tags?: string[];
  order?: number;
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  groupId?: string;
  visibility?: DocumentVisibility;
  status?: DocumentStatus;
  summary?: string;
  tags?: string[];
  order?: number;
}

export interface CreateDocumentGroupData {
  name: string;
  description?: string;
  type: DocumentType;
  order?: number;
  isActive?: boolean;
}

export interface UpdateDocumentGroupData {
  name?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

export interface DocumentsListProps {
  type: DocumentType;
  authContext: AuthContextType;
}

export interface DocumentGroupWithDocuments extends DocumentGroup {
  documents: Document[];
}