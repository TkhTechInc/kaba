import { pickBusinessForUser } from '../user-business-resolver';
import type { User } from '@/nest/modules/auth/entities/User.entity';
import type { BusinessAccess } from '../AccessService';

const bizA: BusinessAccess = { businessId: 'biz-a', role: 'owner' };
const bizB: BusinessAccess = { businessId: 'biz-b', role: 'owner' };
const bizC: BusinessAccess = { businessId: 'biz-c', role: 'accountant' };

function user(prefs?: User['preferences']): User {
  return {
    id: 'usr-1',
    email: 'test@example.com',
    provider: 'local',
    createdAt: '',
    updatedAt: '',
    preferences: prefs,
  };
}

describe('pickBusinessForUser', () => {
  it('returns the only business when user has one', () => {
    const result = pickBusinessForUser(user(), [bizA]);
    expect(result).toBe('biz-a');
  });

  it('uses defaultBusinessId when set and valid', () => {
    const u = user({ defaultBusinessId: 'biz-b' });
    const result = pickBusinessForUser(u, [bizA, bizB, bizC]);
    expect(result).toBe('biz-b');
  });

  it('falls back to businesses[0] when defaultBusinessId is invalid', () => {
    const u = user({ defaultBusinessId: 'biz-nonexistent' });
    const result = pickBusinessForUser(u, [bizA, bizB, bizC]);
    expect(result).toBe('biz-a');
  });

  it('falls back to businesses[0] when user has multiple and no default', () => {
    const result = pickBusinessForUser(user(), [bizA, bizB, bizC]);
    expect(result).toBe('biz-a');
  });

  it('falls back to businesses[0] when preferences is empty', () => {
    const u = user({ locale: 'en' });
    const result = pickBusinessForUser(u, [bizA, bizB]);
    expect(result).toBe('biz-a');
  });

  it('uses defaultBusinessId when it matches second business', () => {
    const u = user({ defaultBusinessId: 'biz-c' });
    const result = pickBusinessForUser(u, [bizA, bizB, bizC]);
    expect(result).toBe('biz-c');
  });
});
