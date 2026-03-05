import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AIQueryService } from './AIQueryService';
import { VoiceToTransactionService } from './VoiceToTransactionService';
import { LoanReadinessService } from './LoanReadinessService';
import { AIQueryDto, CashFlowForecastDto, VoiceToTransactionDto, LoanReadinessDto } from './dto/ai-query.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/ai')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class AIController {
  constructor(
    private readonly aiQueryService: AIQueryService,
    private readonly voiceToTransactionService: VoiceToTransactionService,
    private readonly loanReadinessService: LoanReadinessService,
  ) {}

  @Post('query')
  @Feature('ai_query')
  @RequirePermission('ai:read')
  async ask(@Body() dto: AIQueryDto) {
    const result = await this.aiQueryService.ask(dto.businessId, dto.query);
    return { success: true, data: result };
  }

  @Post('cash-flow-forecast')
  @Feature('ai_query')
  @RequirePermission('ai:read')
  async getCashFlowForecast(@Body() dto: CashFlowForecastDto) {
    const result = await this.aiQueryService.getCashFlowForecast(
      dto.businessId,
      dto.fromDate,
      dto.days ?? 30,
    );
    return { success: true, data: result };
  }

  @Post('voice-to-transaction')
  @Feature('ai_voice')
  @RequirePermission('ai:read')
  async voiceToTransaction(@Body() dto: VoiceToTransactionDto) {
    const result = dto.audioBase64
      ? await this.voiceToTransactionService.processFromAudio(
          Buffer.from(dto.audioBase64, 'base64'),
          dto.businessId,
          dto.currency ?? 'NGN',
        )
      : await this.voiceToTransactionService.processFromText(
          dto.text ?? '',
          dto.businessId,
          dto.currency ?? 'NGN',
        );
    return { success: true, data: result };
  }

  @Post('loan-readiness')
  @Feature('ai_loan_readiness')
  @RequirePermission('lending:read')
  async getLoanReadiness(@Body() dto: LoanReadinessDto) {
    const result = await this.loanReadinessService.getScore(
      dto.businessId,
      dto.fromDate,
      dto.toDate,
    );
    return { success: true, data: result };
  }
}
