import { Test, TestingModule } from '@nestjs/testing';
import { ContractualArrangementsService } from './contractual-arrangements.service';

describe('ContractualArrangementsService', () => {
  let service: ContractualArrangementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContractualArrangementsService],
    }).compile();

    service = module.get<ContractualArrangementsService>(ContractualArrangementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
