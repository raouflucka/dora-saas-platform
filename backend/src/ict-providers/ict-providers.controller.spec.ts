import { Test, TestingModule } from '@nestjs/testing';
import { IctProvidersController } from './ict-providers.controller';

describe('IctProvidersController', () => {
  let controller: IctProvidersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IctProvidersController],
    }).compile();

    controller = module.get<IctProvidersController>(IctProvidersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
