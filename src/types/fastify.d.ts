import type { AuthUser, UserContext } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
    userContext: UserContext;
  }
}
