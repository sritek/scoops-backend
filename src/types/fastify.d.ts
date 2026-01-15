import type { UserContext } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    userContext: UserContext;
  }
}
