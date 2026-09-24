import { createServer, type RequestListener } from 'node:http';
import { once } from 'node:events';
import { afterEach } from 'vitest';

export type TestHttpServer = {
  origin: string;
  url: (pathname: string) => URL;
};

/** Registers cleanup for the current test file and returns a local HTTP server factory. */
export const useHttpServers = () => {
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  return async (listener: RequestListener): Promise<TestHttpServer> => {
    const server = createServer(listener);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    closers.push(
      () =>
        new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    );

    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No HTTP test address');

    const origin = `http://127.0.0.1:${address.port}`;
    return { origin, url: (pathname) => new URL(pathname, origin) };
  };
};

/** Serves a fixed map of `pathname -> body`, 404 for everything else. */
export const staticRoutes =
  (
    routes: Record<
      string,
      string | { body: string; headers?: Record<string, string> }
    >,
  ): RequestListener =>
  (request, response) => {
    const route = routes[request.url ?? ''];
    if (route === undefined) {
      response.statusCode = 404;
      response.end('missing');
      return;
    }
    const { body, headers } =
      typeof route === 'string' ? { body: route, headers: undefined } : route;
    for (const [name, value] of Object.entries(headers ?? {}))
      response.setHeader(name, value);
    response.end(body);
  };
