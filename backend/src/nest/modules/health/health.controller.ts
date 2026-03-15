import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorator';

const healthResponse = () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  message: 'API Server is running',
});

@Controller()
@Public()
export class HealthController {
  @Get('health')
  check() {
    return healthResponse();
  }

  @Get('api/v1/health') // API Gateway only proxies /api/v1/*
  checkApiV1() {
    return healthResponse();
  }
}
