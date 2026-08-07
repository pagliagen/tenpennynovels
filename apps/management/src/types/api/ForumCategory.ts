import type { TopicAccessRule } from './ForumTopic';

export interface ForumCategory {
  _id: string;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  isVisible: boolean;
  color?: string;
  defaultAccessRules: TopicAccessRule[];
  createdAt: string;
}

export interface ForumCategoryListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateForumCategoryData {
  title: string;
  description?: string;
  sortOrder?: number;
  color?: string;
  defaultAccessRules?: TopicAccessRule[];
}

export interface UpdateForumCategoryData extends Partial<CreateForumCategoryData> {
  isVisible?: boolean;
}

export interface ForumCategoryListResponse {
  result: boolean;
  list: ForumCategory[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
