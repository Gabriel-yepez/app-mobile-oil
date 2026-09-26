import type { SubscriptionRecord } from './plans';

export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');

export interface SubscriptionRepository {
  /** null si el usuario nunca tuvo una: está en el gratis. */
  findByUser(userId: string): Promise<SubscriptionRecord | null>;
}
