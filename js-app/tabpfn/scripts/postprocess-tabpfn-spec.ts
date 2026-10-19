import { readFile, writeFile } from 'node:fs/promises';

const filePath = process.argv[2];

if (!filePath) {
  throw new Error(
    'Please provide the bundled OpenAPI file path as an argument.',
  );
}

const spec = JSON.parse(await readFile(filePath, 'utf8')) as {
  paths: Record<string, unknown>;
  servers?: unknown;
};

const predictPath = spec.paths['/predict'];
if (!predictPath || Object.keys(spec.paths).length !== 1) {
  throw new Error(
    `Expected the bundled TabPFN spec to contain only /predict; found ${Object.keys(spec.paths).join(', ')}`,
  );
}

spec.servers = [{ url: '/', description: 'The TabPFN deployment URL.' }];

await writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`);

const requestBody = (
  predictPath as {
    post: { requestBody: { content: Record<string, unknown> } };
  }
).post.requestBody;

for (const [name, mediaType] of [
  ['json', 'application/json'],
  ['multipart', 'multipart/form-data'],
] as const) {
  const content = requestBody.content[mediaType];
  if (!content) {
    throw new Error(`The /predict operation has no ${mediaType} request body.`);
  }

  const splitSpec = structuredClone(spec);
  (
    splitSpec.paths['/predict'] as {
      post: { requestBody: { content: Record<string, unknown> } };
    }
  ).post.requestBody.content = { [mediaType]: content };
  await writeFile(
    filePath.replace(/\.json$/, `-${name}.json`),
    `${JSON.stringify(splitSpec, null, 2)}\n`,
  );
}
