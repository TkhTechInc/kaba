import type { BusinessAccess } from './AccessService';
import type { User } from '@/nest/modules/auth/entities/User.entity';

/**
 * Pick which business to use when a user has multiple.
 * Used by ChatUserResolver and UssdService.
 */
export function pickBusinessForUser(user: User, businesses: BusinessAccess[]): string {
  if (businesses.length === 1) return businesses[0].businessId;
  const defaultId = user.preferences?.defaultBusinessId;
  if (defaultId && businesses.some((b) => b.businessId === defaultId)) {
    return defaultId;
  }
  return businesses[0].businessId;
}
