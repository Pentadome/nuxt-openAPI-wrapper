import path from 'node:path';
import { vi } from 'vitest';

export type RecordedTemplate = {
  filename: string;
  getContents: (...args: unknown[]) => string | Promise<string>;
  write?: boolean;
};

export type RecordedTypeTemplate = RecordedTemplate & {
  context?: {
    nuxt?: boolean;
    nitro?: boolean;
    node?: boolean;
    shared?: boolean;
  };
};

export type RecordedImport = {
  name: string;
  from: string;
  type?: boolean;
  declarationType?: string;
};

/** Records every `@nuxt/kit` call made by `generate()`.
 *
 * Use it from a `vi.mock('@nuxt/kit', ...)` factory:
 * ```ts
 * vi.mock('@nuxt/kit', async (importOriginal) => ({
 *   ...(await importOriginal()),
 *   ...(await import('./helpers/kit-recorder')).kitMocks,
 * }));
 * ```
 */
export const kit = {
  buildDir: '',
  templates: [] as RecordedTemplate[],
  typeTemplates: [] as RecordedTypeTemplate[],
  serverTemplates: [] as RecordedTemplate[],
  imports: [] as RecordedImport[],
  serverImports: [] as RecordedImport[],
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  },
  reset(buildDir: string) {
    this.buildDir = buildDir;
    this.templates = [];
    this.typeTemplates = [];
    this.serverTemplates = [];
    this.imports = [];
    this.serverImports = [];
    for (const fn of Object.values(this.logger)) fn.mockReset();
  },
  template(filename: string) {
    return findByFilename(this.templates, filename);
  },
  typeTemplate(filename: string) {
    return findByFilename(this.typeTemplates, filename);
  },
  serverTemplate(filename: string) {
    return findByFilename(this.serverTemplates, filename);
  },
};

const findByFilename = <T extends { filename: string }>(
  list: T[],
  filename: string,
) => {
  const match = list.find((x) => x.filename === filename);
  if (!match)
    throw new Error(
      `No template "${filename}". Registered: ${JSON.stringify(list.map((x) => x.filename))}`,
    );
  return match;
};

const toArray = <T>(value: T | T[]) => (Array.isArray(value) ? value : [value]);

export const kitMocks = {
  addTemplate: vi.fn((template: RecordedTemplate) => {
    kit.templates.push(template);
    return { ...template, dst: path.join(kit.buildDir, template.filename) };
  }),
  addTypeTemplate: vi.fn(
    (template: RecordedTemplate, context?: RecordedTypeTemplate['context']) => {
      kit.typeTemplates.push({ ...template, context });
      return { ...template, dst: path.join(kit.buildDir, template.filename) };
    },
  ),
  addServerTemplate: vi.fn((template: RecordedTemplate) => {
    kit.serverTemplates.push(template);
    return template;
  }),
  addImports: vi.fn((imports: RecordedImport | RecordedImport[]) => {
    kit.imports.push(...toArray(imports));
  }),
  addServerImports: vi.fn((imports: RecordedImport | RecordedImport[]) => {
    kit.serverImports.push(...toArray(imports));
  }),
  useLogger: vi.fn(() => kit.logger),
};
