// .env is loaded by dotenv-cli in package.json scripts BEFORE this file runs
// This ensures process.env has all values before any imports are resolved

import { buildApp } from './app.js';
import { env } from './config/env.js';
import { createModuleLogger } from './config/logger.js';

const log = createModuleLogger('server');

log.info("========================================");
log.info("SCOOPS BACKEND SERVER STARTING");
log.info("========================================");

log.info(
  { 
    nodeEnv: env.NODE_ENV, 
    port: env.PORT, 
    host: env.HOST, 
    logLevel: env.LOG_LEVEL 
  }, 
  "Configuration loaded"
);

async function start() {
  log.info("Building Fastify application...");
  const startTime = Date.now();
  
  const app = await buildApp();
  
  const buildTime = Date.now() - startTime;
  log.info({ buildTimeMs: buildTime }, "Application built");

  try {
    log.info("Starting HTTP server...");
    await app.listen({ port: env.PORT, host: env.HOST });
    
    log.info("========================================");
    log.info("SERVER READY");
    log.info("========================================");
    
    log.info(
      { 
        url: `http://${env.HOST}:${env.PORT}`,
        docs: `http://${env.HOST}:${env.PORT}/docs`,
        health: `http://${env.HOST}:${env.PORT}/health`
      }, 
      "Server endpoints available"
    );
    
    log.info("Waiting for requests...");
  } catch (err) {
    log.error({ err }, "Failed to start HTTP server");
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  log.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
