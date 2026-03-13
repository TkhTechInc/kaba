import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { MobileService } from './MobileService';
import { MobileHomeQueryDto } from './dto/MobileHomeQuery.dto';
import { MobileSyncQueryDto } from './dto/MobileSyncQuery.dto';

@Controller('api/v1/mobile')
@Auth()
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('home')
  @SkipThrottle()
  async getHome(@Query() query: MobileHomeQueryDto) {
    const result = await this.mobileService.getHome(query.businessId, query.currency);
    return { success: true, data: result };
  }

  @Get('sync')
  async getSync(@Query() query: MobileSyncQueryDto) {
    const result = await this.mobileService.getSync(query.businessId, query.since);
    return { success: true, data: result };
  }
}
