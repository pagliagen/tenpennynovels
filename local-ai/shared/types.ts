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
