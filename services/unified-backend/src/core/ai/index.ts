import { appConfig } from '@config/runtime';
import { AiGatewayClient, DEFAULT_AI_GATEWAY_OPTIONS } from './AiGatewayClient';

export { AiGatewayClient, AiGatewayError } from './AiGatewayClient';
export type { GenerateRequest, GenerateResult } from './AiGatewayClient';

/** Il gateway AI di questo ambiente (da AI_GATEWAY_URL / AI_GATEWAY_SECRET). */
export const aiGateway = new AiGatewayClient({
  ...DEFAULT_AI_GATEWAY_OPTIONS,
  url: appConfig.ai.gatewayUrl,
  secret: appConfig.ai.gatewaySecret,
  okTtlMs: appConfig.ai.probeOkTtlMs,
  failTtlMs: appConfig.ai.probeFailTtlMs,
});
