import { IsBoolean, IsOptional } from 'class-validator';

export class PermaventWeeklySalesReportSourceRequestDto {
  @IsBoolean()
  @IsOptional()
  includeBody = true;
}
