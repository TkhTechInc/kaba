import { Controller, Patch, Get, Body, Req, NotFoundException } from '@nestjs/common';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UserRepository } from './repositories/UserRepository';
import type { JwtPayload } from '@/nest/common/types/auth.types';
import type { Request } from 'express';

@Controller('api/v1/users')
@Auth()
export class UserController {
  constructor(private readonly userRepository: UserRepository) {}

  @Patch('me')
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: Request) {
    const jwtUser = req.user as JwtPayload;
    const user = await this.userRepository.getById(jwtUser.sub);
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.userRepository.update({
      ...user,
      ...(dto.name !== undefined && { name: dto.name }),
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        phone: updated.phone,
        name: updated.name,
        role: updated.role,
      },
    };
  }

  @Get('me/preferences')
  async getPreferences(@Req() req: Request) {
    const jwtUser = req.user as JwtPayload;
    const user = await this.userRepository.getById(jwtUser.sub);
    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      data: user.preferences ?? {},
    };
  }

  @Patch('me/preferences')
  async updatePreferences(@Body() dto: UpdatePreferencesDto, @Req() req: Request) {
    const jwtUser = req.user as JwtPayload;
    const user = await this.userRepository.getById(jwtUser.sub);
    if (!user) throw new NotFoundException('User not found');

    const merged = {
      ...(user.preferences ?? {}),
      ...(dto.locale !== undefined && { locale: dto.locale }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.emailNotifications !== undefined && { emailNotifications: dto.emailNotifications }),
      ...(dto.inAppNotifications !== undefined && { inAppNotifications: dto.inAppNotifications }),
      ...(dto.smsReminders !== undefined && { smsReminders: dto.smsReminders }),
    };

    const updated = await this.userRepository.update({
      ...user,
      preferences: merged,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      data: updated.preferences ?? {},
    };
  }
}
