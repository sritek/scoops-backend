import type { UserContext } from './auth.js';
import type { TenantScope } from './request.js';

declare module 'fastify' {
  interface FastifyRequest {
    userContext: UserContext;
    scope: TenantScope;
    user: { id: string };
  }
}
