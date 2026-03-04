import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AdminAIQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  query!: string;
}
