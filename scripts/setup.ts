/**
 * Ensures all required AI Core deployments exist and are RUNNING.
 *
 * Deployments managed:
 *  - Orchestration  (routes to all LLMs — one deployment covers everything)
 *  - SAP RPT 1.5    (Java agent)
 *  - SAP RPT 1.6    (JS agent, env RPT_MODEL default)
 *
 * Usage:
 *   pnpm setup                  # reads credentials from .env
 *   AICORE_RESOURCE_GROUP=myRG pnpm setup
 */

import type {
  AiConfiguration,
  AiConfigurationBaseData,
  AiDeployment,
  AiParameterArgumentBinding,
} from '@sap-ai-sdk/ai-api';
import { ConfigurationApi, DeploymentApi } from '@sap-ai-sdk/ai-api';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESOURCE_GROUP = process.env.AICORE_RESOURCE_GROUP ?? 'default';
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1_000; // 10 min — deployments can be slow

const header = { 'AI-Resource-Group': RESOURCE_GROUP } as const;

// ---------------------------------------------------------------------------
// Desired deployments
// ---------------------------------------------------------------------------

interface DeploymentSpec {
  label: string;
  configName: string;
  executableId: string;
  scenarioId: string;
  versionId: string;
  parameterBindings?: AiParameterArgumentBinding[];
}

const SPECS: DeploymentSpec[] = [
  {
    label: 'Orchestration',
    configName: 'orchestration',
    executableId: 'orchestration',
    scenarioId: 'orchestration',
    versionId: '0.0.1',
  },
  {
    label: 'SAP RPT 1.5',
    configName: 'rpt-1.5',
    executableId: 'aicore-sap',
    scenarioId: 'foundation-models',
    versionId: '0.0.1',
    parameterBindings: [
      { key: 'modelName', value: 'sap-rpt-1.5' },
      { key: 'modelVersion', value: 'latest' },
    ],
  },
  {
    label: 'SAP RPT 1.6',
    configName: 'rpt-1.6',
    executableId: 'aicore-sap',
    scenarioId: 'foundation-models',
    versionId: '0.0.1',
    parameterBindings: [
      { key: 'modelName', value: 'sap-rpt-1.6' },
      { key: 'modelVersion', value: 'latest' },
    ],
  },
  {
    label: 'TabPFN 3.5-plus',
    configName: 'tabpfn-3.5-plus',
    executableId: 'prior-labs',
    scenarioId: 'foundation-models',
    versionId: '0.0.1',
    parameterBindings: [
      { key: 'modelName', value: 'tabpfn-3.5-plus' },
      { key: 'modelVersion', value: 'latest' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when every desired binding is present with the correct value. */
function bindingsMatch(
  actual: AiParameterArgumentBinding[] | undefined,
  desired: AiParameterArgumentBinding[] | undefined,
): boolean {
  if (!desired?.length) return true;
  if (!actual?.length) return false;
  return desired.every(({ key, value }) =>
    actual.some((b) => b.key === key && b.value === value),
  );
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Returns the deployment ID that satisfies the spec, and whether it needs
 * polling (i.e. it was freshly created or already submitted but not yet RUNNING).
 */
async function ensureDeployment(
  spec: DeploymentSpec,
): Promise<{ id: string; needsPoll: boolean }> {
  const {
    label,
    configName,
    executableId,
    scenarioId,
    versionId,
    parameterBindings,
  } = spec;

  // ---- find or create configuration ----------------------------------------
  const configList = await ConfigurationApi.configurationQuery(
    { executableIds: [executableId], scenarioId, $top: 100 },
    header,
  ).execute();

  const existingConfig = configList.resources.find((c: AiConfiguration) =>
    bindingsMatch(c.parameterBindings, parameterBindings),
  );

  let configId: string;
  if (existingConfig) {
    configId = existingConfig.id;
    console.log(`  [${label}] config exists  ${configId}`);
  } else {
    const body: AiConfigurationBaseData = {
      name: configName,
      executableId,
      scenarioId,
      versionId,
      ...(parameterBindings?.length ? { parameterBindings } : {}),
    };
    const created = await ConfigurationApi.configurationCreate(
      body,
      header,
    ).execute();
    configId = created.id;
    console.log(`  [${label}] config created ${configId}`);
  }

  // ---- find or create deployment --------------------------------------------
  const deploymentList = await DeploymentApi.deploymentQuery(
    { configurationId: configId, $top: 100 },
    header,
  ).execute();

  // UNKNOWN is the initial transient state — treat it as in-flight, not absent.
  const active = deploymentList.resources.find(
    (d: AiDeployment) =>
      d.status === 'RUNNING' ||
      d.status === 'PENDING' ||
      d.status === 'UNKNOWN',
  );

  if (active) {
    console.log(
      `  [${label}] deployment ${active.status.toLowerCase()}  ${active.id}`,
    );
    return { id: active.id, needsPoll: active.status !== 'RUNNING' };
  }

  const deployment = await DeploymentApi.deploymentCreate(
    { configurationId: configId },
    header,
  ).execute();
  console.log(`  [${label}] deployment submitted  ${deployment.id}`);
  return { id: deployment.id, needsPoll: true };
}

/** Polls deployment IDs until all reach RUNNING. Throws on DEAD/STOPPED or timeout. */
async function pollUntilRunning(ids: string[]): Promise<void> {
  const pending = new Set(ids);
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (pending.size > 0) {
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for deployments to start: ${[...pending].join(', ')}`,
      );
    }

    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, POLL_INTERVAL_MS);
    await promise;

    for (const id of [...pending]) {
      const d = await DeploymentApi.deploymentGet(
        id,
        { $select: 'status' },
        header,
      ).execute();
      switch (d.status) {
        case 'RUNNING':
          console.log(`  ${id}  RUNNING ✓`);
          pending.delete(id);
          break;
        case 'DEAD':
        case 'STOPPED':
          throw new Error(
            `Deployment ${id} reached ${d.status}${d.statusMessage ? `: ${d.statusMessage}` : ''}`,
          );
        default:
          console.log(`  ${id}  ${d.status}…`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Resource group: ${RESOURCE_GROUP}\n`);

  const pollIds: string[] = [];

  for (const spec of SPECS) {
    console.log(`${spec.label}`);
    const { id, needsPoll } = await ensureDeployment(spec);
    if (needsPoll) pollIds.push(id);
  }

  if (pollIds.length === 0) {
    console.log('\nAll deployments already running — nothing to do.');
    return;
  }

  console.log(
    `\nWaiting for ${pollIds.length} deployment(s) to reach RUNNING…`,
  );
  await pollUntilRunning(pollIds);
  console.log('\nAll deployments running.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
