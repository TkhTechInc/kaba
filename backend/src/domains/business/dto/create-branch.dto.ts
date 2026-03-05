import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  organizationId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  countryCode?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  /** The businessId of the parent/owner business for access verification */
  @IsString()
  parentBusinessId!: string;
}
