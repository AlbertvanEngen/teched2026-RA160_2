import {
  getFoundationModelDeploymentId,
  getOrchestrationDeploymentId,
} from '@sap-ai-sdk/ai-api/internal.js';
import { getAiCoreDestination } from '@sap-ai-sdk/core';

type AiCoreDestination = Awaited<ReturnType<typeof getAiCoreDestination>>;

const prefetches = [
  (destination: AiCoreDestination) =>
    getOrchestrationDeploymentId({}, destination),
  (destination: AiCoreDestination) =>
    getFoundationModelDeploymentId('sap-rpt-1.6', 'aicore-sap', destination),
  (destination: AiCoreDestination) =>
    getFoundationModelDeploymentId(
      'tabpfn-3.5-plus',
      'prior-labs',
      destination,
    ),
] as const;

let prefetchPromise: Promise<PromiseSettledResult<string>[]> | undefined;

/**
 * Warms the SAP AI Core destination, credentials, and deployment-id caches.
 * The promise is intentionally not returned: startup must not wait for AI Core.
 */
export function prefetchAiCore(): void {
  if (prefetchPromise) return;

  prefetchPromise = getAiCoreDestination()
    .then((destination) =>
      Promise.allSettled(prefetches.map((resolve) => resolve(destination))),
    )
    .catch(() => []);
}
