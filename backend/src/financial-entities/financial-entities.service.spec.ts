import { Test, TestingModule } from '@nestjs/testing';
import { FinancialEntitiesService } from './financial-entities.service';

describe('FinancialEntitiesService', () => {
  let service: FinancialEntitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancialEntitiesService],
    }).compile();

    service = module.get<FinancialEntitiesService>(FinancialEntitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
