import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;

export class BankStatementImportDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(500_000)
  csvText!: string;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  @IsIn(DATE_FORMATS)
  dateFormat?: (typeof DATE_FORMATS)[number];
}
