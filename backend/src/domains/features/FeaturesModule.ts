import { Global, Module } from '@nestjs/common';
import { FeatureService } from './FeatureService';
import { FeaturesController } from './FeaturesController';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { AccessModule } from '@/domains/access/AccessModule';

@Global()
@Module({
  imports: [BusinessModule, AccessModule],
  controllers: [FeaturesController],
  providers: [FeatureService, FeatureGuard],
  exports: [FeatureService, FeatureGuard],
})
export class FeaturesModule {}
