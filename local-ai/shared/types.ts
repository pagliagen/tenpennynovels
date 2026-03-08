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

export interface ImageGenerationRequest {
  style: string;
  options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg' | 'webp';
  };
  callback?: CallbackConfig;
}

export interface ImageGenerationResponse {
  requestId: string;
  image: {
    base64: string;
    format: string;
    width: number;
    height: number;
  };
  metadata: {
    model: string;
    seed: number;
    steps: number;
    processingMs: number;
  };
}
