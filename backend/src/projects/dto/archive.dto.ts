import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ArchiveDto {
  @ApiProperty({ description: 'true to archive, false to unarchive' })
  @IsBoolean()
  archive: boolean;
}
