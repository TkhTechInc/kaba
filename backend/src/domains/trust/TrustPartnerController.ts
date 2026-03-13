import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from '@/nest/common/guards/api-key-auth.guard';
import { BusinessTrustScoreService } from './BusinessTrustScoreService';
import { LoanReadinessService } from '@/domains/ai/LoanReadinessService';

interface LoanReadinessSummary {
  eligible: boolean;
  maxAmount: number;
  currency: string;
}

/**
 * Credit bureau partner endpoint: GET /api/v1/trust/score/:businessId
 * Authenticated via API key (X-API-Key header). Partner keys bypass tier checks.
 */
@Controller('api/v1/trust')
@UseGuards(ApiKeyAuthGuard)
export class TrustPartnerController {
  constructor(
    private readonly businessTrustScoreService: BusinessTrustScoreService,
    @Optional() private readonly loanReadinessService: LoanReadinessService | null,
  ) {}

  @Get('score/:businessId')
  async getCreditScore(
    @Param('businessId') businessId: string,
  ): Promise<{
    businessId: string;
    trustScore: number;
    recommendation: string;
    loanReadiness: LoanReadinessSummary;
    calculatedAt: string;
  }> {
    if (!businessId?.trim()) {
      throw new NotFoundException('businessId is required');
    }

    const scoreResult = await this.businessTrustScoreService.calculate(businessId);

    if (!scoreResult) {
      throw new NotFoundException(`Business ${businessId} not found or has no trust data`);
    }

    const loanReadiness = this.deriveLoanReadiness(scoreResult.trustScore);

    return {
      businessId: scoreResult.businessId,
      trustScore: scoreResult.trustScore,
      recommendation: scoreResult.recommendation,
      loanReadiness,
      calculatedAt: scoreResult.scoredAt,
    };
  }

  /**
   * Derive a simple loan readiness result from the trust score.
   * A full LoanReadinessService call requires an AI provider and date range;
   * this heuristic is sufficient for synchronous partner API responses.
   */
  private deriveLoanReadiness(trustScore: number): LoanReadinessSummary {
    const eligible = trustScore >= 60;

    // Max loan amount scales linearly: 0 at score 60, 2,000,000 XOF at score 100
    const maxAmount = eligible
      ? Math.round(((trustScore - 60) / 40) * 2_000_000)
      : 0;

    return {
      eligible,
      maxAmount,
      currency: 'XOF',
    };
  }
}
