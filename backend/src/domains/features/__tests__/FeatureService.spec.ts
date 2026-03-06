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

    it('whatsapp_invoice_delivery is enabled for pro and enterprise only', () => {
      expect(service.isEnabled('whatsapp_invoice_delivery', 'free')).toBe(false);
      expect(service.isEnabled('whatsapp_invoice_delivery', 'starter')).toBe(false);
      expect(service.isEnabled('whatsapp_invoice_delivery', 'pro')).toBe(true);
      expect(service.isEnabled('whatsapp_invoice_delivery', 'enterprise')).toBe(true);
    });

    it('when launch promo active, all features enabled for any tier', () => {
      const orig = process.env['LAUNCH_PROMO_ENABLED'];
      const origEnd = process.env['LAUNCH_PROMO_END_DATE'];
      try {
        process.env['LAUNCH_PROMO_ENABLED'] = 'true';
        process.env['LAUNCH_PROMO_END_DATE'] = '2099-12-31';
        const promoService = new FeatureService(null as unknown as ConfigService);
        expect(promoService.isEnabled('whatsapp_invoice_delivery', 'free')).toBe(true);
        expect(promoService.isEnabled('invoicing', 'free')).toBe(true);
        expect(promoService.isEnabled('receipts', 'starter')).toBe(true);
      } finally {
        process.env['LAUNCH_PROMO_ENABLED'] = orig;
        process.env['LAUNCH_PROMO_END_DATE'] = origEnd;
      }
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

    it('when launch promo active, free tier gets enterprise limits', () => {
      const orig = process.env['LAUNCH_PROMO_ENABLED'];
      const origEnd = process.env['LAUNCH_PROMO_END_DATE'];
      try {
        process.env['LAUNCH_PROMO_ENABLED'] = 'true';
        process.env['LAUNCH_PROMO_END_DATE'] = '2099-12-31';
        const promoService = new FeatureService(null as unknown as ConfigService);
        expect(promoService.isWithinLimit('ledger', 'free', 99999)).toBe(true);
        expect(promoService.isWithinLimit('ai_query', 'free', 999)).toBe(true);
      } finally {
        process.env['LAUNCH_PROMO_ENABLED'] = orig;
        process.env['LAUNCH_PROMO_END_DATE'] = origEnd;
      }
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
