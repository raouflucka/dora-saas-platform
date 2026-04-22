import { Test, TestingModule } from '@nestjs/testing';
import { FinancialEntitiesController } from './financial-entities.controller';

describe('FinancialEntitiesController', () => {
  let controller: FinancialEntitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialEntitiesController],
    }).compile();

    controller = module.get<FinancialEntitiesController>(FinancialEntitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
