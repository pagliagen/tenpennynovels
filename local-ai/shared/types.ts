export interface CallbackConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
}

export interface ServiceResponse<T = unknown> {
  success: boolean;
  requestId: string;
  data?: T;
  error?: string;
}

export type ImageGenEntityType = 'character' | 'item' | 'location';

export interface ImageGenerationRequest {
  entityType: ImageGenEntityType;
  record: Record<string, unknown>;
  style?: string;
  options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg' | 'webp';
  };
  callback: CallbackConfig;
}

export interface ImageGenerationJobResponse {
  success: boolean;
  jobId: string;
  status: string;
  queuePosition?: number;
}

export interface ImageGenerationCallbackPayload {
  success: boolean;
  jobId: string;
  entityType: ImageGenEntityType;
  image?: {
    base64: string;
    format: string;
    width: number;
    height: number;
  };
  metadata?: {
    model: string;
    seed: number;
    steps: number;
    processingMs: number;
    prompt: string;
  };
  error?: string;
}
