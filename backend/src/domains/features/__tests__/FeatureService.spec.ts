import { FeatureService } from '../FeatureService';
import { ConfigService } from '@nestjs/config';

describe('FeatureService', () => {
  let service: FeatureService;

  beforeEach(() => {
    service = new FeatureService(null as unknown as ConfigService);
  });

  describe('isEnabled', () => {
    it('ledger is enabled for free tier', () => {
      expect(service.isEnabled('ledger', 'free')).toBe(true);
    });

    it('invoicing is not enabled for free tier', () => {
      expect(service.isEnabled('invoicing', 'free')).toBe(false);
    });

    it('invoicing is enabled for starter tier', () => {
      expect(service.isEnabled('invoicing', 'starter')).toBe(true);
    });

    it('ai_query is enabled for pro tier', () => {
      expect(service.isEnabled('ai_query', 'pro')).toBe(true);
    });
  });

  describe('isWithinLimit', () => {
    it('returns true when no limit exists', () => {
      expect(service.isWithinLimit('invoicing', 'starter', 999)).toBe(true);
    });

    it('returns true when within limit', () => {
      expect(service.isWithinLimit('ledger', 'free', 10)).toBe(true);
      expect(service.isWithinLimit('ledger', 'free', 49)).toBe(true);
    });

    it('returns false when at or over limit', () => {
      expect(service.isWithinLimit('ledger', 'free', 50)).toBe(false);
      expect(service.isWithinLimit('ledger', 'free', 100)).toBe(false);
    });

    it('ai_query limit for starter tier', () => {
      expect(service.isWithinLimit('ai_query', 'starter', 9)).toBe(true);
      expect(service.isWithinLimit('ai_query', 'starter', 10)).toBe(false);
    });
  });

  describe('getLimit', () => {
    it('returns limit for feature with limits', () => {
      expect(service.getLimit('ledger', 'free')).toBe(50);
      expect(service.getLimit('ai_query', 'pro')).toBe(100);
    });

    it('returns undefined for feature without limit', () => {
      expect(service.getLimit('invoicing', 'starter')).toBeUndefined();
    });
  });

  describe('getAllFeatures', () => {
    it('returns feature map', () => {
      const features = service.getAllFeatures();
      expect(features.ledger).toBeDefined();
      expect(features.ledger?.enabled).toBe(true);
      expect(features.ledger?.limits?.free).toBe(50);
    });
  });
});
