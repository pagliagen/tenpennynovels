export type OccupationCategory =
  | 'avventurieri' | 'arti_creative' | 'artisti_spettacolo' | 'sport'
  | 'affari' | 'religiosi' | 'criminali' | 'giornalismo'
  | 'lavoro_rurale' | 'lavoro_urbano' | 'tutori_ordine' | 'professione_legale'
  | 'operatori_sanitari' | 'salute_mentale' | 'forze_armate' | 'politica'
  | 'studiosi' | 'professioni_varie';

export interface PopulatedSkillRef {
  _id: string;
  name: string;
  category?: string;
  isPlaceholder?: boolean;
  placeholderType?: string;
}

export interface SkillSlot {
  options: PopulatedSkillRef[];
}

export interface BonusSkillEntry {
  skillId: PopulatedSkillRef | string;
  bonusValue: number;
}

export interface Occupation {
  _id: string;
  name: string;
  description: string;
  category: OccupationCategory;
  contacts: string;
  earnings: string;
  requiredSkillSlots: SkillSlot[];
  bonusSkills: BonusSkillEntry[];
  image?: string;
  isActive: boolean;
  createdBy?: { _id: string; username: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface OccupationListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  category?: OccupationCategory | '';
  isActive?: boolean | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OccupationListResponse {
  result: boolean;
  items: Occupation[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateOccupationData {
  name: string;
  description: string;
  category: OccupationCategory;
  contacts: string;
  earnings: string;
  requiredSkillSlots?: { options: string[] }[];
  bonusSkills?: { skillId: string; bonusValue: number }[];
  image?: string;
  isActive?: boolean;
}

export interface UpdateOccupationData extends Partial<CreateOccupationData> {
  reason?: string;
}
