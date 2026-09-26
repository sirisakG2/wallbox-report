import { APP_VERSION, json } from '../../lib/server.js';

export async function onRequestGet({ env }) {
  return json({
    appVersion: APP_VERSION,
    commit: env.CF_PAGES_COMMIT_SHA || null,
    branch: env.CF_PAGES_BRANCH || null,
    repo: env.GITHUB_REPO || 'sirisakG2/wallbox-report',
  });
}
