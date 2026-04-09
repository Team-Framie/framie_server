import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @IsOptional()
  username?: string;
}
