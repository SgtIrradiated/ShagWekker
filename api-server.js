const http = require('http');
const { URL } = require('url');

const HOST = process.env.API_HOST || '0.0.0.0';
const PORT = Number(process.env.API_PORT || 3000);
const API_PREFIX = '/api/v1';

/**
 * API framework scaffold:
 * - A lightweight route registry
 * - Shared response helpers
 * - Versioned prefix for forwards compatibility
 * - Central place for future SQL-backed services
 */
function createApiApp() {
  const routes = new Map();

  function routeKey(method, path) {
    return `${method.toUpperCase()} ${path}`;
  }

  function register(method, path, handler) {
    routes.set(routeKey(method, path), handler);
  }

  function json(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store'
    });
    res.end(body);
  }

  function notFound(res, pathname) {
    json(res, 404, {
      error: 'not_found',
      message: `No route for ${pathname}`
    });
  }

  function withErrorBoundary(handler) {
    return async (req, res) => {
      try {
        await handler(req, res);
      } catch (error) {
        json(res, 500, {
          error: 'internal_error',
          message: 'An unexpected error occurred.',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    };
  }

  register('GET', `${API_PREFIX}/health`, withErrorBoundary(async (_req, res) => {
    json(res, 200, {
      status: 'ok',
      service: 'ShagWekker API',
      version: 'v1',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      environment: process.env.NODE_ENV || 'development',
      capabilities: {
        health: true,
        meter: false,
        users: false,
        sqlStorage: false
      },
      notes: 'Framework is live. SQL-backed meter/user endpoints can now be added under /api/v1.'
    });
  }));

  register('GET', `${API_PREFIX}`, withErrorBoundary(async (_req, res) => {
    json(res, 200, {
      service: 'ShagWekker API',
      version: 'v1',
      endpoints: {
        health: `${API_PREFIX}/health`
      }
    });
  }));

  return {
    async handle(req, res) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const key = routeKey(req.method || 'GET', url.pathname);
      const handler = routes.get(key);

      if (!handler) {
        notFound(res, url.pathname);
        return;
      }

      await handler(req, res);
    }
  };
}

const app = createApiApp();
const server = http.createServer((req, res) => app.handle(req, res));

server.listen(PORT, HOST, () => {
  console.log(`[ShagWekker API] listening on http://${HOST}:${PORT}${API_PREFIX}`);
});
