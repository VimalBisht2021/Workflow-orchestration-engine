import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BackoffStrategy } from '@prisma/client';

export class TaskDefinitionDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  handler: string;

  @IsArray()
  @IsString({ each: true })
  dependencies: string[];

  @IsOptional()
  @IsNumber()
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  retryDelayMs?: number;

  @IsOptional()
  @IsEnum(BackoffStrategy)
  backoffStrategy?: BackoffStrategy;

  @IsOptional()
  configuration?: any;

  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}

export class CreateWorkflowDto {
  @ApiProperty({
    example: 'Daily ETL Pipeline',
    description: 'The name of the workflow',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Extracts data from DB and loads to Data Warehouse',
    description: 'Optional description of the workflow',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: ['etl', 'daily', 'data'],
    description: 'Tags for filtering and organizing workflows',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    example: 'data-engineering-team',
    description: 'The owner or team responsible for the workflow',
  })
  @IsString()
  owner: string;

  @ApiPropertyOptional({
    description: 'Tasks in the workflow',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskDefinitionDto)
  tasks?: TaskDefinitionDto[];
}
