import { apiClient, withRetry } from './client';
import type {
  Skill,
  SkillListParams,
  SkillListResponse,
  CreateSkillData,
  UpdateSkillData
} from '@/types/api/Skill';
import type { ApiResponse } from '@/types/api/common';

export async function getSkills(params: SkillListParams): Promise<SkillListResponse> {
  const { pageSize, ...rest } = params;
  const requestParams = { ...rest, limit: pageSize };

  const response = await withRetry(() =>
    apiClient.get<SkillListResponse>('/admin/skills', { params: requestParams })
  );
  return response.data;
}

export async function getSkillById(id: string): Promise<Skill> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<Skill>>(`/admin/skills/${id}`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero skill');
  }

  return response.data.data;
}

export async function createSkill(data: CreateSkillData): Promise<Skill> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<Skill>>('/admin/skills', data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione skill');
  }

  return response.data.data;
}

export async function updateSkill(id: string, data: UpdateSkillData): Promise<Skill> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<Skill>>(`/admin/skills/${id}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento skill');
  }

  return response.data.data;
}

export async function deleteSkill(id: string, reason?: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/skills/${id}`, {
      data: reason ? { reason } : undefined
    })
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione skill');
  }
}
