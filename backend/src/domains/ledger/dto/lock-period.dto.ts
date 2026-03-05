import { IsString, IsInt, Min, Max } from 'class-validator';

export class LockPeriodDto {
  @IsString()
  businessId!: string;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
