export interface SocialClass {
  _id: string;
  name: string;
  label: string;
  minFinanceSkill: number;
  maxFinanceSkill: number;
  weeklyCredit: number;
  initialWealth: {
    minCash: number;
    maxCash: number;
    hasPrivateApartment: boolean;
    apartmentType?: string;
    bonusItems: string[];
  };
  displayOrder: number;
  description?: string;
  usage?: { characterCount: number };
  createdAt: string;
  updatedAt: string;
}

export interface SocialClassListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SocialClassListResponse {
  result: boolean;
  data: {
    socialClasses: SocialClass[];
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

export interface CreateSocialClassData {
  name: string;
  label: string;
  minFinanceSkill: number;
  maxFinanceSkill: number;
  weeklyCredit: number;
  initialWealth: {
    minCash: number;
    maxCash: number;
    hasPrivateApartment: boolean;
    apartmentType?: string;
    bonusItems?: string[];
  };
  displayOrder: number;
  description?: string;
}

export interface UpdateSocialClassData extends Partial<CreateSocialClassData> {
  reason?: string;
}
