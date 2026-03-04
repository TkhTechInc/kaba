import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorator';

@Controller()
@Public()
export class HealthController {
  @Get('health')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'API Server is running',
    };
  }
}
