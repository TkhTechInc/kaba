import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreatePayRunDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'periodMonth must be YYYY-MM' })
  periodMonth!: string;
}
