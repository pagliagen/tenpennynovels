/**
 * Character Creation Hooks
 *
 * TanStack Query hooks for character creation configuration.
 * Handles caching and automatic refetching of occupations and skills.
 *
 * @module hooks/useCharacterCreation
 * @since 2.0.0
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

import {
  characterCreationApi,
  CharacterCreationConfig,
  Occupation,
  Skill,
} from '@/lib/api/characterCreation';

/**
 * Query Keys
 */
export const characterCreationKeys = {
  all: ['characterCreation'] as const,
  config: () => [...characterCreationKeys.all, 'config'] as const,
  occupations: () => [...characterCreationKeys.all, 'occupations'] as const,
  skills: () => [...characterCreationKeys.all, 'skills'] as const,
};

/**
 * Get Complete Character Creation Configuration
 *
 * @returns Character creation config query
 * @example
 * const { data: config, isLoading } = useCharacterCreationConfig();
 */
export function useCharacterCreationConfig(): UseQueryResult<CharacterCreationConfig, Error> {
  return useQuery({
    queryKey: characterCreationKeys.config(),
    queryFn: () => characterCreationApi.getConfig(),
    staleTime: 1000 * 60 * 10, // 10 minutes (config rarely changes)
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Get All Available Occupations
 *
 * @returns Occupations query
 * @example
 * const { data: occupations, isLoading } = useOccupations();
 */
export function useOccupations(): UseQueryResult<Occupation[], Error> {
  return useQuery({
    queryKey: characterCreationKeys.occupations(),
    queryFn: () => characterCreationApi.getOccupations(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Get All Available Skills
 *
 * @returns Skills query
 * @example
 * const { data: skills, isLoading } = useSkills();
 */
export function useSkills(): UseQueryResult<Skill[], Error> {
  return useQuery({
    queryKey: characterCreationKeys.skills(),
    queryFn: () => characterCreationApi.getSkills(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}
