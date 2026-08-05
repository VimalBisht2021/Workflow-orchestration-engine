import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
}
