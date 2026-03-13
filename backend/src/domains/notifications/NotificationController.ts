import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { NotificationService } from './services/NotificationService';
import { Auth } from '@/nest/common/decorators/auth.decorator';

class ListNotificationsQueryDto {
  @IsString()
  businessId!: string;

  @IsOptional()
  limit?: number;
}

class MarkReadDto {
  @IsString()
  businessId!: string;

  @IsString()
  createdAt!: string;
}

class MarkAllReadDto {
  @IsString()
  businessId!: string;
}

@Controller('api/v1/notifications')
@Auth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(@Query() query: ListNotificationsQueryDto) {
    const limit = query.limit ? Math.min(Number(query.limit), 50) : 30;
    const [items, unread] = await Promise.all([
      this.notificationService.list(query.businessId, limit),
      this.notificationService.countUnread(query.businessId),
    ]);
    return { success: true, data: { items, unread } };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Body() dto: MarkReadDto) {
    await this.notificationService.markRead(dto.businessId, id, dto.createdAt);
    return { success: true };
  }

  @Patch('read-all')
  async markAllRead(@Body() dto: MarkAllReadDto) {
    await this.notificationService.markAllRead(dto.businessId);
    return { success: true };
  }
}
