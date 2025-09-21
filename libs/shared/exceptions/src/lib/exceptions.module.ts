import { Module } from '@nestjs/common';

import { GlobalExceptionFilter, ValidationExceptionFilter } from './filters/global-exception.filter';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';

@Module({
  controllers: [],
  providers: [
    ZodValidationPipe,
    GlobalExceptionFilter,
    ValidationExceptionFilter,
  ],
  exports: [
    ZodValidationPipe,
    GlobalExceptionFilter,
    ValidationExceptionFilter,
  ],
})
export class UsecapsuleExceptionsModule {}
