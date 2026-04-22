import { Test, TestingModule } from '@nestjs/testing';
import { ContractualArrangementsController } from './contractual-arrangements.controller';

describe('ContractualArrangementsController', () => {
  let controller: ContractualArrangementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractualArrangementsController],
    }).compile();

    controller = module.get<ContractualArrangementsController>(ContractualArrangementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
