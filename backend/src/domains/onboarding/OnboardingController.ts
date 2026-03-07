import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OnboardingService } from './OnboardingService';
import { OnboardingAIService } from './OnboardingAIService';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { OnboardingAIChatDto } from './dto/ai-chat.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { CurrentUser } from '@/nest/common/decorators/current-user.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import type { OnboardingAnswers } from './models/OnboardingState';

@Controller('api/v1/onboarding')
@Auth()
@UseGuards(PermissionGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly onboardingAIService: OnboardingAIService,
  ) {}

  @Get()
  @SkipThrottle()
  @RequirePermission('business:settings')
  async getProgress(
    @Query('businessId') businessId: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const progress = await this.onboardingService.getProgress(
      businessId.trim(),
      userId,
    );
    return { success: true, data: progress };
  }

  @Patch()
  @RequirePermission('business:settings')
  async update(
    @Query('businessId') businessId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateOnboardingDto,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const answers: Partial<OnboardingAnswers> = {};
    if (dto.businessName != null) answers.businessName = dto.businessName;
    if (dto.businessType != null) answers.businessType = dto.businessType;
    if (dto.country != null) answers.country = dto.country;
    if (dto.currency != null) answers.currency = dto.currency;
    if (dto.taxRegime != null) answers.taxRegime = dto.taxRegime;
    if (dto.businessAddress != null) answers.businessAddress = dto.businessAddress;
    if (dto.businessPhone != null) answers.businessPhone = dto.businessPhone;
    if (dto.fiscalYearStart != null) answers.fiscalYearStart = dto.fiscalYearStart;

    const progress = dto.step
      ? await this.onboardingService.updateStep(
          businessId.trim(),
          userId,
          dto.step,
          answers,
        )
      : await this.onboardingService.patch(
          businessId.trim(),
          userId,
          answers,
          { onboardingComplete: dto.onboardingComplete },
        );
    return { success: true, data: progress };
  }

  @Post('complete')
  @RequirePermission('business:settings')
  async complete(
    @Query('businessId') businessId: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const progress = await this.onboardingService.completeOnboarding(
      businessId.trim(),
      userId,
    );
    return { success: true, data: progress };
  }

  @Post('ai-chat')
  @RequirePermission('business:settings')
  async aiChat(
    @Query('businessId') businessId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: OnboardingAIChatDto,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    if (!dto.message?.trim()) {
      throw new BadRequestException('message is required');
    }
    const progress = await this.onboardingService.getProgress(
      businessId.trim(),
      userId,
    );
    const suggestions = await this.onboardingAIService.parseUserMessage(
      dto.message.trim(),
      progress.step,
      progress.answers,
    );
    return { success: true, data: suggestions };
  }
}
