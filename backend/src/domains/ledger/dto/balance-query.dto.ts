import { IsString } from 'class-validator';

export class BalanceQueryDto {
  @IsString()
  businessId!: string;
}
