/**
 * Fake PNG (PNG Light) Types
 * Max 5 fake identities per character for chat masking
 */

export interface FakePng {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FakePngListResponse {
  fakePngs: FakePng[];
  activeFakePngId: string | null;
}

export interface CreateFakePngRequest {
  name: string;
  surname?: string;
  avatar?: string;
}

export interface UpdateFakePngRequest {
  name?: string;
  surname?: string;
  avatar?: string;
}
