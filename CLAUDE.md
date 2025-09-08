# Capsule Platform - Convenções e Padrões de Desenvolvimento

## 📚 Documentação de Referência

- **PRD Completo**: [docs/PRD.md](docs/PRD.md)
- **README**: [README.md](README.md)

## 🏗️ Arquitetura do Sistema

### Estrutura de Microserviços

O Capsule utiliza uma arquitetura de microserviços com comunicação via
RabbitMQ:

```
API Gateway (HTTP) → RabbitMQ → Microserviços
```

**Importante**: Apenas o API Gateway expõe endpoints HTTP. Todos os
microserviços comunicam-se exclusivamente via RabbitMQ.

### Microserviços Planejados

1. **api-gateway** - Gateway principal (BFF)
2. **auth-service** - Autenticação e autorização
3. **deploy-service** - Orquestração de deployments
4. **monitor-service** - Monitoramento e observabilidade
5. **notification-service** - Notificações e alertas
6. **billing-service** - Faturamento e cobrança
7. **project-service** - Gerenciamento de projetos
8. **organization-service** - Gerenciamento de organizações

## 🛠️ Stack Tecnológica

### Backend
- **Framework**: NestJS 11
- **Runtime**: Node.js 20+
- **Linguagem**: TypeScript 5.8
- **Monorepo**: Nx 21.4

### Database e Migrações
- **Database**: PostgreSQL 15 (uma instância por serviço)
- **Query Builder**: Slonik (type-safe, connection pooling)
- **Migrations**: Flyway (Docker-based, versionamento)
- **Padrão**: Database per Service (isolamento completo)

### Infraestrutura
- **Cache**: Redis 7
- **Message Queue**: RabbitMQ 3
- **Secrets**: HashiCorp Vault
- **Container**: Docker
- **Orchestration**: Kubernetes

## 📁 Estrutura de Pastas

```
@usecapsule/source/
├── apps/                     # Aplicações
│   ├── api-gateway/         # Gateway principal
│   └── *-service/           # Microserviços
├── libs/                    # Bibliotecas compartilhadas
│   ├── contexts/           # Lógica de domínio
│   │   ├── auth/          # Contexto de autenticação
│   │   ├── deploy/        # Contexto de deployment
│   │   └── monitor/       # Contexto de monitoramento
│   └── shared/            # Utilitários compartilhados
│       ├── dto/          # Data Transfer Objects
│       └── types/        # TypeScript types
├── tools/                   # Ferramentas de desenvolvimento
│   ├── cli/                # CLI do Capsule
│   └── sdk/                # SDKs multi-linguagem
│       ├── node/          # Node.js/TypeScript SDK
│       ├── go/            # Go SDK
│       ├── python/        # Python SDK
│       ├── php/           # PHP SDK
│       ├── ruby/          # Ruby SDK
│       └── rust/          # Rust SDK
└── infrastructure/        # Configurações de infra
    ├── docker/           # Docker configs
    ├── flyway/           # Configurações de migração
    ├── migrations/       # Scripts SQL de migração
    │   ├── auth-service/ # Migrações do auth-service
    │   ├── project-service/ # Migrações do project-service
    │   └── deploy-service/  # Migrações do deploy-service
    └── k8s/             # Kubernetes manifests
```

## 🔌 Padrões de Comunicação

### API Gateway → Microserviços

```typescript
// Enviar comando para microserviço
@Injectable()
export class DeploymentGateway {
  constructor(
    @Inject('DEPLOYMENT_SERVICE') private client: ClientProxy,
  ) {}

  async deployService(data: DeployServiceDto) {
    return this.client.send('deploy.create', data);
  }
}
```

### Microserviço → Processamento

```typescript
// Receber comando no microserviço
@Controller()
export class DeployController {
  @MessagePattern('deploy.create')
  async handleDeploy(data: DeployServiceDto) {
    // Processar deployment
  }

  @EventPattern('deploy.completed')
  async handleDeployCompleted(data: DeploymentEvent) {
    // Processar evento
  }
}
```

## 🗄️ Database e Migrações

### Padrão Database per Service

Cada microserviço possui sua própria instância de banco:

```typescript
// Configuração específica por serviço
export const AUTH_DB_CONFIG = createDatabaseConfig('auth-service');
export const PROJECT_DB_CONFIG = createDatabaseConfig('project-service');
export const DEPLOY_DB_CONFIG = createDatabaseConfig('deploy-service');
```

### Slonik - Queries Type-Safe

```typescript
// Serviço de database compartilhado
@Injectable()
export class DatabaseService implements OnModuleDestroy,
    OnApplicationBootstrap {
  private pool!: DatabasePool;

  async onApplicationBootstrap() {
    const connectionString = 
      `postgresql://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;
    this.pool = await createPool(connectionString, {
      maximumPoolSize: 10,
      connectionTimeout: 5000,
      idleTimeout: 60000,
    });
  }

  getPool(): DatabasePool { return this.pool; }
}
```

### Uso em Services

```typescript
@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findUserByEmail(email: string) {
    const pool = this.databaseService.getPool();
    return pool.one(sql.typeAlias('user')`
      SELECT id, email, name, password_hash, is_active 
      FROM users 
      WHERE email = ${email} AND is_active = true
    `);
  }
}
```

### Flyway - Controle de Versão

```bash
# Executar migrações
npm run migrate:auth              # Auth service
npm run migrate:project           # Project service  
npm run migrate:deploy            # Deploy service

# Verificar status
npm run migrate:auth:info         # Status das migrações
npm run migrate:auth:validate     # Validar arquivos SQL
```

### Estrutura de Migração

```sql
-- infrastructure/migrations/auth-service/V001__create_users_table.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
```

### Configuração por Ambiente

```env
# Desenvolvimento - auth-service
AUTH_DB_HOST=localhost
AUTH_DB_PORT=5432
AUTH_DB_USER=usecapsule_auth
AUTH_DB_PASSWORD=usecapsule_dev_password
AUTH_DB_NAME=usecapsule_auth

# Produção - auth-service  
AUTH_DB_HOST=auth-postgres.internal
AUTH_DB_PORT=5432
AUTH_DB_USER=${AUTH_DB_USER}
AUTH_DB_PASSWORD=${AUTH_DB_PASSWORD}
AUTH_DB_NAME=usecapsule_auth_prod
```

## 🔐 Autenticação e Autorização

### Níveis de Acesso da API

1. **Rotas Públicas** - Sem autenticação
   - Health checks
   - Documentação Swagger
   - Service discovery

2. **Rotas com Token** - API Key
   - SDKs
   - CI/CD
   - Integrações

3. **Rotas Privadas** - JWT
   - Dashboard
   - Admin
   - Configurações sensíveis

### Guards e Decorators

```typescript
// Rota pública
@Get('health')
@Public()
healthCheck() {}

// Rota com API Key
@Get('deploy')
@UseGuards(ApiKeyGuard)
@ApiKey()
deploy() {}

// Rota com JWT
@Get('profile')
@UseGuards(JwtAuthGuard)
@Roles('admin', 'developer')
getProfile() {}
```

## 📝 Convenções de Código

### Nomenclatura

- **Arquivos**: kebab-case (ex: `auth-service.ts`)
- **Classes**: PascalCase (ex: `AuthService`)
- **Interfaces**: PascalCase com prefixo I (ex: `IAuthService`)
- **Métodos**: camelCase (ex: `validateUser`)
- **Constantes**: UPPER_SNAKE_CASE (ex: `MAX_RETRIES`)

### DTOs e Validação

```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name: string;
}
```

### Tratamento de Erros

```typescript
// Usar exceções específicas do NestJS
throw new BadRequestException('Invalid input');
throw new UnauthorizedException('Token invalid');
throw new NotFoundException('Resource not found');
```


## 🚀 Deployment

### Ambientes

- **development** - Local com Docker Compose
- **staging** - Pré-produção
- **production** - Produção

### Variáveis de Ambiente

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://:password@host:6379

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672

# Auth
JWT_SECRET=your-secret
JWT_EXPIRY=1h
```

## 📊 Monitoramento

### Métricas Essenciais

- CPU e Memória por serviço
- Taxa de requisições e erros
- Latência de resposta (P50, P95, P99)
- Health checks e uptime

### Logs Estruturados

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger('AuthService');

logger.log('User authenticated', { userId, email });
logger.error('Authentication failed', error.stack, { email });
```

## 🔄 CI/CD

### Pipeline Padrão

1. **Lint** - Verificação de código
2. **Build** - Compilação
3. **Deploy** - Deployment automático

### Commits Semânticos

```
feat: adiciona nova funcionalidade
fix: corrige bug específico
docs: atualiza documentação
style: formatação de código
refactor: refatoração sem mudança de funcionalidade
chore: tarefas de manutenção
```

## 🛠️ Ferramentas de Desenvolvimento

### CLI do Capsule

O CLI permite gerenciar deployments via linha de comando:

```bash
# Estrutura planejada
capsule auth login
capsule deploy --name my-app --image node:18
capsule logs my-app --follow
capsule env set my-app DATABASE_URL=postgresql://...
capsule scale my-app --replicas 3
```

### SDKs Multi-linguagem

SDKs oficiais para integração com diferentes linguagens:

#### Node.js/TypeScript
```typescript
import { Capsule } from '@usecapsule/sdk';

const capsule = new Capsule({ apiKey: process.env.CAPSULE_API_KEY });
const deployment = await capsule.deployments.create({
  name: 'my-app',
  image: 'node:18-alpine'
});
```

#### Go
```go
client := capsule.NewClient(&capsule.Config{
  APIKey: os.Getenv("CAPSULE_API_KEY"),
})

deployment, err := client.Deployments.Create(ctx, &capsule.DeploymentOptions{
  Name: "my-go-app",
  Image: "golang:1.21-alpine",
})
```

#### Python
```python
from capsule import Capsule

capsule = Capsule(api_key=os.getenv('CAPSULE_API_KEY'))
deployment = capsule.deployments.create(
  name='my-app',
  image='python:3.11-slim'
)
```

### Distribuição

- **CLI**: Binário executável multiplataforma
- **Node.js SDK**: npm (@usecapsule/sdk)
- **Go SDK**: Go modules (github.com/usecapsule/go-sdk)
- **Python SDK**: PyPI (capsule-sdk)
- **PHP SDK**: Packagist (usecapsule/sdk)
- **Ruby SDK**: RubyGems (capsule-sdk)
- **Rust SDK**: crates.io (capsule-sdk)

## 📌 Checklist de Desenvolvimento

### Ao criar novo microserviço:

- [ ] Configurar comunicação RabbitMQ
- [ ] Criar database específico no docker-compose
- [ ] Configurar Flyway para migrações
- [ ] Adicionar biblioteca @usecapsule/database
- [ ] Implementar health check (incluindo DB)
- [ ] Adicionar documentação Swagger
- [ ] Configurar variáveis de ambiente de DB
- [ ] Adicionar logs estruturados
- [ ] Configurar Dockerfile
- [ ] Atualizar docker-compose
- [ ] Documentar no README

### Ao criar nova migração:

- [ ] Nomear arquivo: `V{version}__{description}.sql`
- [ ] Incluir rollback plan nos comentários
- [ ] Validar com `npm run migrate:{service}:validate`
- [ ] Documentar mudanças no schema

### Ao criar novo endpoint:

- [ ] Definir DTO com validação
- [ ] Adicionar documentação Swagger
- [ ] Implementar guard apropriado
- [ ] Tratar erros adequadamente
- [ ] Adicionar logs
- [ ] Verificar performance

### Ao desenvolver CLI:

- [ ] Implementar parsing de comandos
- [ ] Adicionar validação de argumentos
- [ ] Configurar autenticação
- [ ] Implementar client HTTP
- [ ] Adicionar logs estruturados
- [ ] Criar testes unitários
- [ ] Documentar comandos
- [ ] Implementar auto-complete

### Ao desenvolver SDK:

- [ ] Definir interface do client
- [ ] Implementar autenticação
- [ ] Adicionar validação de tipos
- [ ] Implementar streaming (logs)
- [ ] Tratar erros específicos da linguagem
- [ ] Adicionar middleware para frameworks
- [ ] Criar exemplos de uso
- [ ] Documentar API completa
- [ ] Configurar distribuição (npm, PyPI, etc.)
- [ ] Implementar testes de integração

## 🆘 Suporte e Recursos

- **Issues**: [GitHub Issues](https://github.com/danilomartinelli/usecapsule-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/danilomartinelli/usecapsule-api/discussions)
- **Docs NestJS**: [nestjs.com](https://nestjs.com)
- **Docs Nx**: [nx.dev](https://nx.dev)

---

*Última atualização: 2025-09-07 - Adicionado sistema de migrações com
Slonik + Flyway*