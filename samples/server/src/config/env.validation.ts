import { Type, plainToInstance } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class EnvVars {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  APP_PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsOptional()
  @IsString()
  REDIS_USERNAME?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  REDIS_DB = 0;

  @IsString()
  @IsNotEmpty()
  REDIS_KEY_PREFIX = 'fateflow:auth:';

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CALLBACK_URL!: string;

  @IsString()
  @IsNotEmpty()
  ALLOWED_APP_ORIGINS = 'http://localhost:5173,https://*.fateflow.app';

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN = '30d';

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(600)
  AUTH_LOGIN_CODE_EXPIRES_IN_SECONDS = 60;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
