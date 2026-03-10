import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { API_CONFIG } from '@/constants/config';
import type { DocumentType } from '@/types/document';

const SEARCH_DEBOUNCE_MS = 400;

// --- Question detection (mirrors backend questionDetector.ts) ---

const QUESTION_PREFIXES = [
  'chi', 'cosa', 'come', 'dove', 'quando', 'perché', 'perche',
  "qual è", "qual'è", 'quale', 'quali', 'quanti', 'quante', 'quanto', 'quanta',
  'che cosa', "che cos'è",
];

const REQUEST_PREFIXES = [
  'mi trovi', 'mi dici', 'mi spieghi', 'mi puoi', 'mi potresti',
  'mi dai', 'mi daresti', 'mi fai', 'mi faresti',
  'dimmi', 'spiegami', 'elencami', 'parlami', 'descrivi', 'raccontami',
  'trovami', 'dammi', 'fammi',
  'puoi dirmi', 'puoi spiegarmi', 'puoi trovarmi', 'puoi darmi',
  'vorrei sapere', 'voglio sapere',
  'mi aiuti', 'mi puoi aiutare', 'mi potresti aiutare', 'puoi aiutarmi',
  'puoi darmi una mano', 'mi daresti una mano', 'puoi aiutare', 'aiutami',
];

const ALL_PREFIXES = [...QUESTION_PREFIXES, ...REQUEST_PREFIXES];

function isQuestion(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 5) return false;
  if (trimmed.endsWith('?')) return true;
  const lower = trimmed.toLowerCase();
  return ALL_PREFIXES.some(prefix => lower.startsWith(prefix + ' '));
}

// --- Types ---

interface SearchResult {
  document: {
    _id: string;
    slug: string;
    title: string;
    content: string;
    tags: string[];
    isDraft: boolean;
  };
  route: {
    path: string;
    type: DocumentType;
    subtypeTitle: string;
    anchor: string;
    fullPath: string;
  };
  matchLevel: number;
  matchHeading: string;
  similarity: number;
  matchScore: string;
}

interface AIAnswerSource {
  heading: string;
  slug?: string;
  fullPath?: string;
  title?: string;
  used: boolean;
}

export interface AIAnswer {
  answer: string;
  sources: AIAnswerSource[];
  model?: string;
}

export interface AIEnrichment {
  enrichment: string;
  source: {
    title: string;
    fullPath: string;
  };
  step: number;
}

export interface AIReading {
  title: string;
  fullPath: string;
}

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

interface UseSearchOptions {
  type?: DocumentType;
  limit?: number;
  minSimilarity?: number;
  enabled?: boolean;
}

/**
 * Semantic search hook for non-question queries (standard JSON response).
 */
export function useSearch(query: string = '', options: UseSearchOptions = {}) {
  const { type, limit = 5, minSimilarity = 0.3, enabled = true } = options;

  const queryKey = ['search', query, type, limit, minSimilarity];

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!query || query.trim().length < 2) {
        return { results: [], totalResults: 0, query: '' };
      }

      const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString(),
        minSimilarity: minSimilarity.toString(),
      });

      if (type) {
        params.append('type', type);
      }

      const response = await api.get<{ data: SearchResponse }>(
        `/documents/semantic-search?${params.toString()}`
      );

      return response.data;
    },
    enabled: enabled && query.trim().length >= 2 && !isQuestion(query),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return queryResult;
}

/**
 * Parse an SSE text chunk into individual events.
 * Handles partial chunks by tracking buffer state.
 */
function parseSSEEvents(buffer: string): { events: Array<{ event: string; data: string }>; remaining: string } {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = buffer.split('\n\n');
  const remaining = blocks.pop() || '';

  for (const block of blocks) {
    if (!block.trim() || block.trim().startsWith(':')) continue;

    let event = 'message';
    let data = '';

    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        event = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (data) {
      events.push({ event, data });
    }
  }

  return { events, remaining };
}

/**
 * SSE search hook using fetch + ReadableStream.
 * More robust than EventSource for cross-origin + React StrictMode.
 */
function useSSESearch(query: string, options: UseSearchOptions = {}) {
  const { type, limit = 5, minSimilarity = 0.3, enabled = true } = options;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [aiAnswer, setAiAnswer] = useState<AIAnswer | undefined>();
  const [aiEnrichments, setAiEnrichments] = useState<AIEnrichment[]>([]);
  const [aiReading, setAiReading] = useState<AIReading | undefined>();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiComplete, setAiComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !query || query.trim().length < 2 || !isQuestion(query)) {
      abortRef.current?.abort();
      abortRef.current = null;
      setResults([]);
      setTotalResults(0);
      setAiAnswer(undefined);
      setAiEnrichments([]);
      setAiReading(undefined);
      setAiLoading(false);
      setAiComplete(false);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();

    const abortController = new AbortController();
    abortRef.current = abortController;

    setResults([]);
    setTotalResults(0);
    setAiAnswer(undefined);
    setAiEnrichments([]);
    setAiReading(undefined);
    setAiLoading(true);
    setAiComplete(false);
    setIsLoading(true);

    const params = new URLSearchParams({
      q: query.trim(),
      limit: limit.toString(),
      minSimilarity: minSimilarity.toString(),
    });
    if (type) {
      params.append('type', type);
    }

    const url = `${API_CONFIG.BASE_URL}/documents/semantic-search?${params.toString()}`;
    const t0 = Date.now();

    (async () => {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'Accept': 'text/event-stream' },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          console.error('[SSE] Bad response:', response.status);
          setAiLoading(false);
          setIsLoading(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const { events, remaining } = parseSSEEvents(sseBuffer);
          sseBuffer = remaining;

          for (const { event, data } of events) {
            console.log(`[SSE] +${Date.now() - t0}ms event: ${event}`);

            if (event === 'results') {
              try {
                const parsed = JSON.parse(data);
                setResults(parsed.data?.results || []);
                setTotalResults(parsed.data?.totalResults || 0);
                setIsLoading(false);
              } catch { /* skip */ }
            } else if (event === 'ai_answer') {
              try {
                const parsed = JSON.parse(data);
                setAiAnswer({
                  answer: parsed.answer,
                  sources: parsed.sources || [],
                  model: parsed.model,
                });
              } catch { /* skip */ }
            } else if (event === 'ai_reading') {
              try {
                const parsed = JSON.parse(data);
                setAiReading({
                  title: parsed.title,
                  fullPath: parsed.fullPath,
                });
              } catch { /* skip */ }
            } else if (event === 'ai_enrichment') {
              try {
                const parsed = JSON.parse(data);
                setAiReading(undefined);
                setAiEnrichments(prev => [...prev, {
                  enrichment: parsed.enrichment,
                  source: {
                    title: parsed.source?.title || '',
                    fullPath: parsed.source?.fullPath || '',
                  },
                  step: parsed.step,
                }]);
              } catch { /* skip */ }
            } else if (event === 'complete') {
              setAiReading(undefined);
              setAiLoading(false);
              setAiComplete(true);
            }
          }
        }

        setAiReading(undefined);
        setAiLoading(false);
        setAiComplete(true);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('[SSE] Fetch error:', err);
        setAiLoading(false);
        setIsLoading(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [query, type, limit, minSimilarity, enabled]);

  return {
    results,
    totalResults,
    aiAnswer,
    aiEnrichments,
    aiReading,
    aiLoading,
    aiComplete,
    isLoading,
  };
}

/**
 * Search state manager for interactive search UI.
 * Uses debounced query. Automatically switches between
 * standard JSON search and SSE search based on query type.
 */
export function useSearchState() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const isQuestionQuery = isQuestion(debouncedQuery);
  const searchEnabled = isOpen && debouncedQuery.length >= 2;

  const standardSearch = useSearch(debouncedQuery, {
    enabled: searchEnabled && !isQuestionQuery,
  });

  const sseSearch = useSSESearch(debouncedQuery, {
    enabled: searchEnabled && isQuestionQuery,
  });

  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.trim().length >= 2) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setDebouncedQuery('');
    clearTimeout(timerRef.current);
  }, []);

  if (isQuestionQuery) {
    return {
      query,
      setQuery: handleSearch,
      isOpen,
      setIsOpen,
      results: sseSearch.results,
      totalResults: sseSearch.totalResults,
      isLoading: sseSearch.isLoading || (query !== debouncedQuery && query.trim().length >= 2),
      error: null,
      aiAnswer: sseSearch.aiAnswer,
      aiEnrichments: sseSearch.aiEnrichments,
      aiReading: sseSearch.aiReading,
      aiLoading: sseSearch.aiLoading,
      aiComplete: sseSearch.aiComplete,
      handleClose,
    };
  }

  return {
    query,
    setQuery: handleSearch,
    isOpen,
    setIsOpen,
    results: standardSearch.data?.results || [],
    totalResults: standardSearch.data?.totalResults || 0,
    isLoading: standardSearch.isLoading || (query !== debouncedQuery && query.trim().length >= 2),
    error: standardSearch.error,
    aiAnswer: undefined,
    aiEnrichments: [],
    aiReading: undefined,
    aiLoading: false,
    aiComplete: false,
    handleClose,
  };
}
