import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  branchCode?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;
}
