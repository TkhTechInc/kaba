import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '@/domains/features/feature.types';

export const FEATURE_KEY = 'feature';

/**
 * Guard a route by feature and tier. Requires businessId in request body or query.
 * Use with FeatureGuard.
 */
export const Feature = (featureKey: FeatureKey) => SetMetadata(FEATURE_KEY, featureKey);
