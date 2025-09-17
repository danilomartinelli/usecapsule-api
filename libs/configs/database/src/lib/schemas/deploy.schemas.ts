import { z } from 'zod';

import { BaseEntitySchema, SoftDeletableEntitySchema } from './common.schemas';

/**
 * Project schema for deployment service
 */
export const ProjectSchema = SoftDeletableEntitySchema.extend({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  repositoryUrl: z.string().url(),
  repositoryProvider: z.enum(['github', 'gitlab', 'bitbucket']),
  repositoryId: z.string(),
  defaultBranch: z.string().default('main'),
  framework: z.enum([
    'nextjs',
    'react',
    'vue',
    'angular',
    'svelte',
    'static',
    'nodejs',
    'python',
    'go',
    'rust',
    'php',
    'ruby',
  ]),
  buildCommand: z.string().nullable(),
  outputDirectory: z.string().default('dist'),
  nodeVersion: z.string().nullable(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  isPublic: z.boolean().default(false),
  customDomain: z.string().nullable(),
  sslEnabled: z.boolean().default(true),
  autoDeployEnabled: z.boolean().default(true),
  deployOnPushBranches: z.array(z.string()).default(['main']),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Deployment schema
 */
export const DeploymentSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  commitSha: z.string().min(1),
  commitMessage: z.string(),
  branch: z.string(),
  status: z.enum([
    'pending',
    'queued',
    'building',
    'deploying',
    'ready',
    'error',
    'canceled',
  ]),
  deploymentUrl: z.string().url().nullable(),
  previewUrl: z.string().url().nullable(),
  buildLogs: z.string().nullable(),
  deployLogs: z.string().nullable(),
  buildStartedAt: z.coerce.date().nullable(),
  buildCompletedAt: z.coerce.date().nullable(),
  deployStartedAt: z.coerce.date().nullable(),
  deployCompletedAt: z.coerce.date().nullable(),
  buildDuration: z.number().int().nonnegative().nullable(),
  deployDuration: z.number().int().nonnegative().nullable(),
  size: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  isProduction: z.boolean().default(false),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Domain schema for custom domains
 */
export const DomainSchema = SoftDeletableEntitySchema.extend({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  domain: z.string().min(1),
  isApex: z.boolean().default(false),
  verified: z.boolean().default(false),
  verificationRecord: z.string().nullable(),
  verifiedAt: z.coerce.date().nullable(),
  sslStatus: z.enum(['pending', 'issued', 'failed']).default('pending'),
  sslIssuedAt: z.coerce.date().nullable(),
  redirectTo: z.string().nullable(),
  isPrimary: z.boolean().default(false),
  gitBranch: z.string().nullable(),
});

/**
 * Environment variable schema
 */
export const EnvironmentVariableSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  key: z.string().min(1).max(255),
  value: z.string(),
  environment: z.enum(['development', 'preview', 'production']),
  encrypted: z.boolean().default(true),
  description: z.string().max(500).nullable(),
});

/**
 * Build configuration schema
 */
export const BuildConfigSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  framework: z.string(),
  buildCommand: z.string().nullable(),
  outputDirectory: z.string(),
  installCommand: z.string().nullable(),
  nodeVersion: z.string().nullable(),
  pythonVersion: z.string().nullable(),
  dockerfile: z.string().nullable(),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  functions: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
});

/**
 * Webhook schema for deployment notifications
 */
export const WebhookSchema = SoftDeletableEntitySchema.extend({
  projectId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(
    z.enum([
      'deployment.created',
      'deployment.ready',
      'deployment.error',
      'deployment.canceled',
      'domain.verified',
      'domain.failed',
    ]),
  ),
  secret: z.string().nullable(),
  isActive: z.boolean().default(true),
  lastTriggeredAt: z.coerce.date().nullable(),
  lastSuccessAt: z.coerce.date().nullable(),
  lastFailureAt: z.coerce.date().nullable(),
  failureCount: z.number().int().nonnegative().default(0),
});

/**
 * Function schema for serverless functions
 */
export const FunctionSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  path: z.string(),
  runtime: z.enum(['nodejs18', 'nodejs20', 'python39', 'python310', 'go119']),
  memory: z.number().int().min(128).max(3008).default(1024),
  timeout: z.number().int().min(1).max(900).default(10),
  environmentVariables: z.record(z.string(), z.string()).default({}),
  codeSize: z.number().int().nonnegative(),
  lastInvocation: z.coerce.date().nullable(),
  invocationCount: z.number().int().nonnegative().default(0),
  errorCount: z.number().int().nonnegative().default(0),
});

/**
 * Analytics schema for deployment metrics
 */
export const AnalyticsSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid().nullable(),
  domainId: z.string().uuid().nullable(),
  timestamp: z.coerce.date(),
  type: z.enum([
    'page_view',
    'function_invocation',
    'bandwidth',
    'edge_request',
  ]),
  path: z.string().nullable(),
  country: z.string().length(2).nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  userAgent: z.string().nullable(),
  referer: z.string().nullable(),
  ip: z.string().nullable(),
  responseTime: z.number().int().nonnegative().nullable(),
  statusCode: z.number().int().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Edge location schema for CDN
 */
export const EdgeLocationSchema = BaseEntitySchema.extend({
  code: z.string().length(3),
  name: z.string(),
  country: z.string().length(2),
  region: z.string(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  isActive: z.boolean().default(true),
  capacity: z.number().int().positive(),
  currentLoad: z.number().int().nonnegative().default(0),
});

// Type exports
export type Project = z.infer<typeof ProjectSchema>;
export type Deployment = z.infer<typeof DeploymentSchema>;
export type Domain = z.infer<typeof DomainSchema>;
export type EnvironmentVariable = z.infer<typeof EnvironmentVariableSchema>;
export type BuildConfig = z.infer<typeof BuildConfigSchema>;
export type Webhook = z.infer<typeof WebhookSchema>;
export type Function = z.infer<typeof FunctionSchema>;
export type Analytics = z.infer<typeof AnalyticsSchema>;
export type EdgeLocation = z.infer<typeof EdgeLocationSchema>;
