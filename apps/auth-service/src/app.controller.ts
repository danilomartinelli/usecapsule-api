import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern('auth.health')
  healthCheck() {
    return this.appService.healthCheck();
  }

  @MessagePattern('auth.validate_token')
  validateToken(@Payload() data: { token: string }) {
    return this.appService.validateToken(data.token);
  }

  @MessagePattern('auth.login')
  login(@Payload() data: { email: string; password: string }) {
    return this.appService.login(data.email, data.password);
  }

  @MessagePattern('auth.register')
  register(@Payload() data: { email: string; password: string; name: string }) {
    return this.appService.register(data.email, data.password, data.name);
  }
}
