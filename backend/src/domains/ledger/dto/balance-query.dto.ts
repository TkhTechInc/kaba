import { IsString, IsNotEmpty } from 'class-validator';

export class BalanceQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'businessId is required' })
  businessId!: string;
}
