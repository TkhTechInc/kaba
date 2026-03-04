import { IsString, MaxLength } from 'class-validator';

export class OnboardingAIChatDto {
  @IsString()
  @MaxLength(2000)
  message!: string;
}
