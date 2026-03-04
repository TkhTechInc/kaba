import { IsString } from 'class-validator';

export class GetCustomerQueryDto {
  @IsString()
  businessId!: string;
}
