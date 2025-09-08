# @libs/shared/dto

## Data Transfer Objects

Biblioteca compartilhada contendo todos os DTOs (Data Transfer Objects)
utilizados na comunicação entre microserviços via RabbitMQ e nas respostas da
API Gateway.

### Propósito

- **Contratos unificados**: Define os contratos de dados entre todos os
  serviços
- **Type Safety**: Garante tipagem forte com TypeScript/NestJS
- **Validação**: Integração com class-validator para validação automática
- **Serialização**: Suporte a transformação de dados com class-transformer

### Estrutura Esperada

```
dto/
├── auth/
│   ├── login.dto.ts
│   ├── token.dto.ts
│   └── user.dto.ts
├── deployment/
│   ├── deploy.dto.ts
│   └── status.dto.ts
├── common/
│   ├── pagination.dto.ts
│   └── response.dto.ts
└── index.ts
```

### Uso

```typescript
import { UserDto, LoginDto } from '@libs/shared/dto';

// Em microserviços (RabbitMQ)
@MessagePattern('auth.login')
async handleLogin(data: LoginDto): Promise<UserDto> {
  // ...
}

// Na API Gateway (REST/GraphQL)
@Post('/auth/login')
async login(@Body() loginDto: LoginDto): Promise<UserDto> {
  // ...
}
```

### Convenções

- DTOs devem ser classes decoradas com validadores
- Usar `@ApiProperty()` para documentação Swagger
- Manter DTOs imutáveis e sem lógica de negócio
- Versionamento através de namespaces quando necessário