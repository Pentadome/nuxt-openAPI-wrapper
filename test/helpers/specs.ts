import path from 'node:path';
import { pathToFileURL } from 'node:url';

const specsDirectory = path.resolve(
  import.meta.dirname,
  '..',
  'fixtures',
  'specs',
);

export const specPath = (...segments: string[]) =>
  path.join(specsDirectory, ...segments);

export const specUrl = (...segments: string[]) =>
  pathToFileURL(specPath(...segments));

/** Smallest valid document; the only path is `GET /health`. */
export const minimalDocument = {
  openapi: '3.0.3',
  info: { title: 'Minimal', version: '1.0.0' },
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth',
        responses: { '200': { description: 'healthy' } },
      },
    },
  },
} as const;

export const minimalYaml = `
openapi: 3.0.3
info:
  title: Minimal
  version: 1.0.0
paths:
  /health:
    get:
      operationId: getHealth
      responses:
        '200':
          description: healthy
`;
