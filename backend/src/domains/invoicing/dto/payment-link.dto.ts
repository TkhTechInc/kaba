import { IsString } from 'class-validator';

export class GeneratePaymentLinkDto {
  @IsString()
  businessId!: string;
}
