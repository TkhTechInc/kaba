/**
 * Regional compliance rules (NDPR, Ghana DPA, ECOWAS).
 * Stub implementation for West Africa data protection.
 */
export interface RegionalCompliance {
  region: string;
  countryCode: string;
  framework: string;
  retentionDays?: number;
  requiresConsent?: boolean;
}

export function getComplianceForRegion(countryCode: string): RegionalCompliance {
  const code = (countryCode || 'ECOWAS').toUpperCase();
  if (code === 'NG' || code === 'NIGERIA') {
    return {
      region: 'West Africa',
      countryCode: 'NG',
      framework: 'NDPR',
      retentionDays: 2555,
      requiresConsent: true,
    };
  }
  if (code === 'GH' || code === 'GHANA') {
    return {
      region: 'West Africa',
      countryCode: 'GH',
      framework: 'Ghana DPA',
      retentionDays: 2555,
      requiresConsent: true,
    };
  }
  return {
    region: 'West Africa',
    countryCode: code,
    framework: 'ECOWAS',
    retentionDays: 2555,
    requiresConsent: true,
  };
}
