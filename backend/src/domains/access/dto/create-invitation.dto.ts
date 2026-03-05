import { IsString, IsIn, IsOptional, IsNumber } from 'class-validator';
import type { Role } from '../role.types';

export class CreateInvitationDto {
  @IsString()
  emailOrPhone!: string;

  @IsString()
  businessId!: string;

  @IsString()
  @IsIn(['owner', 'accountant', 'viewer', 'sales'])
  role!: Role;

  @IsOptional()
  @IsNumber()
  expiresInHours?: number;
}
