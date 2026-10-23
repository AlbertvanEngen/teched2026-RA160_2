import {
  getFoundationModelDeploymentId,
  getOrchestrationDeploymentId,
} from '@sap-ai-sdk/ai-api/internal.js';

const prefetches = [
  () => getOrchestrationDeploymentId({}),
  () => getFoundationModelDeploymentId('sap-rpt-1.6', 'aicore-sap'),
  () => getFoundationModelDeploymentId('tabpfn-3.5-plus', 'prior-labs'),
] as const;

let prefetchPromise: Promise<PromiseSettledResult<string>[]> | undefined;

/**
 * Warms the SAP AI Core destination, credentials, and deployment-id caches.
 * The promise is intentionally not returned: startup must not wait for AI Core.
 */
export function prefetchAiCore(): void {
  if (prefetchPromise) return;

  prefetchPromise = Promise.allSettled(prefetches.map((resolve) => resolve()));
}
