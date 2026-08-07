export interface Skill {
  _id: string;
  id: string;
  name: string;
  baseValue: string | number;
  category: string;
  categoryLabel?: string;
  description: string;
  visible: boolean;
  defaultSkill: boolean;
  isPlaceholder: boolean;
  placeholderType?: string;
  predefinedValues?: string[];
  canRollWithoutPoints: boolean;
  lockedForPlayer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  category?: string;
  visible?: boolean | string;
  defaultSkill?: boolean | string;
  isPlaceholder?: boolean | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SkillListResponse {
  result: boolean;
  data: {
    skills: Skill[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export interface CreateSkillData {
  name: string;
  baseValue: string | number;
  category: string;
  description: string;
  visible?: boolean;
  defaultSkill?: boolean;
  isPlaceholder?: boolean;
  placeholderType?: string;
  predefinedValues?: string[];
  canRollWithoutPoints?: boolean;
  lockedForPlayer?: boolean;
}

export interface UpdateSkillData extends Partial<CreateSkillData> {
  reason?: string;
}
