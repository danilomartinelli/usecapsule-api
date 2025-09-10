import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

/**
 * Main application controller for the Auth Service.
 *
 * This controller handles HTTP requests in the microservice architecture,
 * providing endpoints for health checks and service status. In production,
 * most communication occurs via RabbitMQ message patterns.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint returning service identification.
   *
   * @returns Service status information
   */
  @Get()
  getData(): Readonly<{ message: string }> {
    return this.appService.getData();
  }
}
