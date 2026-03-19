import { IsString, IsOptional, IsInt, IsIn, Min, Max, Matches, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class ListEntriesQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'businessId is required' })
  businessId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['sale', 'expense'])
  type?: 'sale' | 'expense';

  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX)
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX)
  toDate?: string;
}
