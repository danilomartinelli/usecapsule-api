import { z } from 'zod';

import { BaseEntitySchema, SoftDeletableEntitySchema } from './common.schemas';

/**
 * Customer schema for billing service
 */
export const CustomerSchema = SoftDeletableEntitySchema.extend({
  userId: z.string().uuid(),
  stripeCustomerId: z.string().nullable(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  companyName: z.string().max(200).nullable(),
  billingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().nullable(),
      city: z.string(),
      state: z.string().nullable(),
      postalCode: z.string(),
      country: z.string(),
    })
    .nullable(),
  taxId: z.string().nullable(),
  currency: z.string().length(3).default('USD'),
  timezone: z.string().default('UTC'),
});

/**
 * Subscription plan schema
 */
export const SubscriptionPlanSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  stripePriceId: z.string(),
  currency: z.string().length(3),
  amount: z.number().int().nonnegative(),
  interval: z.enum(['month', 'year']),
  intervalCount: z.number().int().positive().default(1),
  trialPeriodDays: z.number().int().nonnegative().nullable(),
  features: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

/**
 * Customer subscription schema
 */
export const SubscriptionSchema = SoftDeletableEntitySchema.extend({
  customerId: z.string().uuid(),
  planId: z.string().uuid(),
  stripeSubscriptionId: z.string(),
  status: z.enum([
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ]),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  trialStart: z.coerce.date().nullable(),
  trialEnd: z.coerce.date().nullable(),
  canceledAt: z.coerce.date().nullable(),
  cancelAtPeriodEnd: z.boolean().default(false),
  quantity: z.number().int().positive().default(1),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Payment method schema
 */
export const PaymentMethodSchema = SoftDeletableEntitySchema.extend({
  customerId: z.string().uuid(),
  stripePaymentMethodId: z.string(),
  type: z.enum(['card', 'bank_account', 'sepa_debit', 'ideal', 'paypal']),
  isDefault: z.boolean().default(false),
  cardLast4: z.string().length(4).nullable(),
  cardBrand: z.string().nullable(),
  cardExpMonth: z.number().int().min(1).max(12).nullable(),
  cardExpYear: z.number().int().nullable(),
  bankAccountLast4: z.string().length(4).nullable(),
  bankName: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Invoice schema
 */
export const InvoiceSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().nullable(),
  stripeInvoiceId: z.string(),
  number: z.string(),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']),
  currency: z.string().length(3),
  subtotal: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative(),
  amountPaid: z.number().int().nonnegative().default(0),
  amountRemaining: z.number().int().nonnegative().default(0),
  description: z.string().nullable(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  dueDate: z.coerce.date().nullable(),
  paidAt: z.coerce.date().nullable(),
  voidedAt: z.coerce.date().nullable(),
  attemptCount: z.number().int().nonnegative().default(0),
  nextPaymentAttempt: z.coerce.date().nullable(),
  webhookDeliveredAt: z.coerce.date().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Payment transaction schema
 */
export const PaymentSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().nullable(),
  stripePaymentIntentId: z.string(),
  stripeChargeId: z.string().nullable(),
  paymentMethodId: z.string().uuid(),
  status: z.enum([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'requires_capture',
    'canceled',
    'succeeded',
    'failed',
  ]),
  currency: z.string().length(3),
  amount: z.number().int().nonnegative(),
  amountCaptured: z.number().int().nonnegative().default(0),
  amountRefunded: z.number().int().nonnegative().default(0),
  description: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  receiptEmail: z.string().email().nullable(),
  receiptUrl: z.string().url().nullable(),
  refunded: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Refund schema
 */
export const RefundSchema = BaseEntitySchema.extend({
  paymentId: z.string().uuid(),
  stripeRefundId: z.string(),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']),
  status: z.enum(['pending', 'succeeded', 'failed', 'canceled']),
  description: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  failureReason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Usage record schema for metered billing
 */
export const UsageRecordSchema = BaseEntitySchema.extend({
  subscriptionId: z.string().uuid(),
  subscriptionItemId: z.string(),
  quantity: z.number().int().nonnegative(),
  timestamp: z.coerce.date(),
  action: z.enum(['increment', 'set']),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Billing event schema for audit trail
 */
export const BillingEventSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  type: z.enum([
    'customer.created',
    'customer.updated',
    'customer.deleted',
    'subscription.created',
    'subscription.updated',
    'subscription.deleted',
    'invoice.created',
    'invoice.paid',
    'invoice.payment_failed',
    'payment.succeeded',
    'payment.failed',
    'refund.created',
    'payment_method.attached',
    'payment_method.detached',
  ]),
  data: z.record(z.string(), z.unknown()),
  stripeEventId: z.string().nullable(),
  processed: z.boolean().default(false),
  processedAt: z.coerce.date().nullable(),
  errorMessage: z.string().nullable(),
});

// Type exports
export type Customer = z.infer<typeof CustomerSchema>;
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Refund = z.infer<typeof RefundSchema>;
export type UsageRecord = z.infer<typeof UsageRecordSchema>;
export type BillingEvent = z.infer<typeof BillingEventSchema>;
