import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './routes/auth.js';
import { oauth } from './routes/oauth.js';
import { keys } from './routes/keys.js';
import { fallback } from './routes/fallback.js';
import { v1, chatSession } from './routes/chat.js';

export type AppMode = 'local' | 'cloud';

export function createPreciousApp(options: {
  mode: AppMode;
  webDist?: string;
  corsOrigins?: string[];
}) {
  if (options.mode === 'cloud') {
    process.env.PRECIOUS_CLOUD_MODE = '1';
  }

  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: options.corsOrigins ?? [
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.WEB_ORIGIN ?? '',
      ].filter(Boolean),
      credentials: true,
      exposeHeaders: [
        'X-Precious-Provider',
        'X-Precious-Model',
        'X-Precious-Tokens',
        'X-Failover-From',
        'X-Routed-Via',
      ],
    }),
  );

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      mode: options.mode,
      scaffold: options.mode === 'cloud' ? false : undefined,
    }),
  );

  app.route('/api/auth', auth);
  app.route('/api/auth/oauth', oauth);
  app.route('/api/keys', keys);
  app.route('/api/fallback-chain', fallback);
  app.route('/v1', v1);
  app.route('/api/chat', chatSession);

  const webDist = options.webDist;
  if (webDist) {
    // Static UI served by Node server in local/docker all-in-one mode
    app.get('/', (c) => c.redirect('/settings/keys'));
  }

  return app;
}
