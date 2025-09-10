/**
 * Configuration factories for all services in the microservices architecture.
 *
 * This module exports factory functions that create configuration objects
 * for each service. These factories are used in conjunction with Zod schemas
 * to provide type-safe, validated configuration.
 *
 * Available factories:
 * - `authServiceFactory` - Auth Service configuration factory
 * - `apiGatewayFactory` - API Gateway configuration factory
 * - `deployServiceFactory` - Deploy Service configuration factory
 *
 * @example
 * ```typescript
 * import { authServiceFactory, apiGatewayFactory, deployServiceFactory } from '@usecapsule/parameters';
 * import { authServiceSchema, apiGatewaySchema, deployServiceSchema } from '@usecapsule/parameters';
 *
 * // Create and validate configurations
 * const authConfig = authServiceSchema.parse(authServiceFactory());
 * const gatewayConfig = apiGatewaySchema.parse(apiGatewayFactory());
 * const deployConfig = deployServiceSchema.parse(deployServiceFactory());
 * ```
 */

export * from './auth-service.factory';
export * from './api-gateway.factory';
export * from './deploy-service.factory';
