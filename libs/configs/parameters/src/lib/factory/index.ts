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
 * - `billingServiceFactory` - Billing Service configuration factory
 * - `deployServiceFactory` - Deploy Service configuration factory
 * - `monitorServiceFactory` - Monitor Service configuration factory
 * - `timeoutFactory` - Timeout configuration factory
 *
 * @example
 * ```typescript
 * import {
 *   authServiceFactory,
 *   apiGatewayFactory,
 *   billingServiceFactory,
 *   deployServiceFactory,
 *   monitorServiceFactory
 * } from '@usecapsule/parameters';
 * import {
 *   authServiceSchema,
 *   apiGatewaySchema,
 *   billingServiceSchema,
 *   deployServiceSchema,
 *   monitorServiceSchema
 * } from '@usecapsule/parameters';
 *
 * // Create and validate configurations
 * const authConfig = authServiceSchema.parse(authServiceFactory());
 * const gatewayConfig = apiGatewaySchema.parse(apiGatewayFactory());
 * const billingConfig = billingServiceSchema.parse(billingServiceFactory());
 * const deployConfig = deployServiceSchema.parse(deployServiceFactory());
 * const monitorConfig = monitorServiceSchema.parse(monitorServiceFactory());
 * ```
 */

export * from './api-gateway.factory';
export * from './auth-service.factory';
export * from './billing-service.factory';
export * from './deploy-service.factory';
export * from './monitor-service.factory';
export * from './timeout.factory';
