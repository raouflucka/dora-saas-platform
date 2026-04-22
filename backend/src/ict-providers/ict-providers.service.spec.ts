import { Test, TestingModule } from '@nestjs/testing';
import { IctProvidersService } from './ict-providers.service';

describe('IctProvidersService', () => {
  let service: IctProvidersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IctProvidersService],
    }).compile();

    service = module.get<IctProvidersService>(IctProvidersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
