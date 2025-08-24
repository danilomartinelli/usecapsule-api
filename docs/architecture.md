# Arquitetura Técnica - Capsule

Este documento detalha a arquitetura técnica do projeto Capsule, incluindo decisões de design, padrões utilizados e estrutura do sistema.

## 🏗️ Visão Geral da Arquitetura

### Princípios Arquiteturais

- **Domain-Driven Design (DDD)** - Organização por bounded contexts
- **Hexagonal Architecture** - Isolamento de domínio via ports & adapters
- **Event-Driven Architecture** - Comunicação assíncrona via eventos
- **Feature-Sliced Design (FSD)** - Organização frontend escalável
- **Monorepo com Nx** - Gerenciamento eficiente de múltiplos projetos

### Diagrama de Alto Nível

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Portal        │    │  API Gateway    │    │  Microserviços  │
│   (React)       │◄──►│   (NestJS)      │◄──►│   (NestJS)      │
│   - Dashboard   │    │   - BFF         │    │   - Deploy      │
│   - UI/UX       │    │   - Auth        │    │   - Billing     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Shared        │    │   Contexts      │    │   External      │
│   Libraries     │    │   (DDD)         │    │   Services      │
│   - DTOs        │    │   - Domain      │    │   - Vault       │
│   - Types       │    │   - Application │    │   - Registries  │
│   - UI          │    │   - Infrastructure│  │   - Brokers     │
└─────────────────┘    └─────────────────┘    └─────────────────┘

```

## 🏛️ Estrutura do Monorepo

### Organização por Camadas

```
capsule/
├── apps/                    # Aplicações executáveis
│   ├── portal/             # Frontend React (Dashboard)
│   ├── api-gateway/        # Backend NestJS (BFF)
├── libs/                    # Bibliotecas compartilhadas
│   ├── contexts/           # Bounded Contexts (Backend)
│   │   ├── deploy/         # Contexto de Deploy
│   │   ├── billing/        # Contexto de Cobrança
│   │   └── discovery/      # Contexto de Service Discovery
│   ├── shared/             # Compartilhado Full-Stack
│   │   ├── dto/            # DTOs compartilhados
│   │   └── types/          # Tipos compartilhados
│   └── ui/                 # Frontend-only
│       └── react/          # Biblioteca de componentes
├── tools/                   # Ferramentas de desenvolvimento
│   ├── cli/                # CLI oficial
│   ├── generators/         # Generators customizados
│   └── dev-server/         # Servidor de desenvolvimento local
├── docs/                    # Documentação interna do projeto
└── [public-docs build]      # Documentação pública hospedada
```

### Regras de Dependências

#### ✅ Dependências Permitidas

```
Frontend Apps → UI Libraries
Frontend Apps → Shared Libraries
Backend Apps → Context Libraries
Backend Apps → Shared Libraries
Tools → Shared Libraries
```

#### ❌ Dependências Proibidas

```
Backend Apps → UI Libraries
Context Libraries → UI Libraries
Context Libraries → Other Context Libraries (via imports)
```

## 🎯 Bounded Contexts (DDD)

### Contexto de Deploy

**Responsabilidade**: Gerenciamento do ciclo de vida de aplicações e serviços.

#### Estrutura Hexagonal

```
libs/contexts/deploy/
├── domain/                 # Camada de Domínio
│   ├── entities/          # Entidades de negócio
│   │   ├── AppEntity.ts
│   │   └── ServiceEntity.ts
│   ├── value-objects/     # Objetos de valor
│   │   ├── ImageRef.ts
│   │   └── HealthStatus.ts
│   ├── events/            # Eventos de domínio
│   │   ├── AppDeployedEvent.ts
│   │   └── ServiceScaledEvent.ts
│   └── repositories/      # Interfaces de repositório
│       └── AppRepository.port.ts
├── application/           # Camada de Aplicação
│   ├── use-cases/        # Casos de uso
│   │   ├── DeployAppUseCase.ts
│   │   └── ScaleServiceUseCase.ts
│   ├── ports/            # Portas (interfaces)
│   │   ├── ContainerRegistry.port.ts
│   │   └── RuntimeOrchestrator.port.ts
│   └── dtos/             # DTOs de aplicação
│       └── DeployAppDto.ts
└── infrastructure/        # Camada de Infraestrutura
    ├── adapters/         # Adaptadores
    │   ├── NestDeployController.ts
    │   ├── PostgresAppRepository.ts
    │   └── DockerRuntimeAdapter.ts
    └── module.ts         # Módulo NestJS
```

#### Exemplo de Use Case

```typescript
// application/use-cases/DeployAppUseCase.ts
export class DeployAppUseCase {
  constructor(private readonly appRepo: AppRepositoryPort, private readonly registry: ContainerRegistryPort, private readonly runtime: RuntimeOrchestratorPort, private readonly eventPublisher: EventPublisherPort) {}

  async execute(dto: DeployAppDto): Promise<AppEntity> {
    // 1. Validar imagem no registry
    const image = await this.registry.fetchImageMetadata(dto.imageRef);

    // 2. Criar entidade de aplicação
    const app = AppEntity.create({
      name: dto.name,
      image: image.digest,
      environment: dto.environment,
    });

    // 3. Persistir aplicação
    await this.appRepo.save(app);

    // 4. Deploy no runtime
    await this.runtime.deploy(app);

    // 5. Publicar evento
    await this.eventPublisher.publish(new AppDeployedEvent(app.id));

    return app;
  }
}
```

### Contexto de Billing

**Responsabilidade**: Gerenciamento de cobrança, quotas e limites de uso.

### Contexto de Discovery

**Responsabilidade**: Service discovery, DNS interno e políticas de rede.

## 🎨 Frontend (Feature-Sliced Design)

### Estrutura FSD

```
apps/portal/src/
├── app/                    # Inicialização da aplicação
│   ├── providers/         # Context providers
│   ├── router/            # Configuração de rotas
│   └── styles/            # Estilos globais
├── pages/                 # Páginas/Rotas
│   ├── dashboard/         # Dashboard principal
│   ├── services/          # Lista de serviços
│   └── settings/          # Configurações
├── widgets/               # Blocos de UI compostos
│   ├── header/            # Header da aplicação
│   ├── sidebar/           # Sidebar de navegação
│   └── service-card/      # Card de serviço
├── features/              # Features de negócio
│   ├── deploy-app/        # Feature de deploy
│   ├── manage-service/    # Gerenciamento de serviço
│   └── view-logs/         # Visualização de logs
├── entities/              # Entidades de domínio
│   ├── app/               # Entidade App
│   ├── service/           # Entidade Service
│   └── user/              # Entidade User
└── shared/                # Código compartilhado
    ├── ui/                # Componentes de UI
    ├── api/               # API clients
    └── lib/               # Utilitários
```

### Exemplo de Feature

```typescript
// features/deploy-app/ui/DeployForm.tsx
export function DeployForm() {
  const [image, setImage] = useState('');
  const deploy = useDeploy();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        deploy.mutate({ image });
      }}
    >
      <input placeholder="ghcr.io/org/api:tag" value={image} onChange={(e) => setImage(e.target.value)} />
      <button>Deploy</button>
      {deploy.isSuccess && <p>Deployment iniciado</p>}
    </form>
  );
}

// features/deploy-app/model/useDeploy.ts
export function useDeploy() {
  const setLastDeployment = useDeployStore((s) => s.setLastDeployment);

  return useMutation({
    mutationFn: deployClient.start,
    onSuccess: (res) => setLastDeployment(res.deploymentId),
  });
}
```

## 🛠️ Ferramentas de Desenvolvimento

### CLI (@usecapsule/cli)

**Arquitetura**: Aplicação Node.js com TypeScript e esbuild.

#### Estrutura de Comandos

```typescript
// Estrutura hierárquica
capsule auth login
capsule services deploy
capsule broker create rabbitmq

// Implementação de comando
export class DeployCommand {
  static command = 'deploy';
  static description = 'Deploy a service to Capsule';
  static options = [
    { name: 'image', type: 'string', required: true },
    { name: 'env', type: 'string', default: 'production' }
  ];

  async execute(options: DeployOptions) {
    // Implementação
  }
}
```

### Generators (@usecapsule/generators)

**Arquitetura**: Plugin Nx com templates customizados.

#### Estrutura de Generators

```typescript
// Generators disponíveis
export class ServiceGenerator {
  static name = 'service';
  static description = 'Generate a new Capsule microservice';

  static schema = {
    name: {
      type: 'string',
      required: true,
      pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
    },
    context: {
      type: 'string',
      description: 'Bounded context name',
    },
  };

  async generate(options: ServiceOptions) {
    // Gera estrutura hexagonal completa
  }
}
```

### Dev Server (@usecapsule/dev-server)

**Arquitetura**: Aplicação Node.js para desenvolvimento local.

#### Funcionalidades

- **Orquestração local**: Emula ambiente Capsule com Docker Compose
- **Proxy reverso**: Roteamento local para serviços
- **Health checks**: Monitoramento de saúde dos serviços
- **Log aggregation**: Agregação de logs centralizada
- **Hot reload**: Recarregamento automático de configurações

#### Estrutura

```typescript
// Orquestrador principal
export class DevOrchestrator {
  async start() {
    // Inicia containers (Redis, RabbitMQ, PostgreSQL)
    // Configura proxy reverso
    // Inicia health checker
    // Configura log aggregator
  }
}
```

## 🔄 Comunicação entre Camadas

### Event-Driven Architecture

```typescript
// Eventos de domínio
export class AppDeployedEvent {
  constructor(public readonly appId: string, public readonly imageDigest: string, public readonly deployedAt: Date) {}
}

// Event handlers
@EventsHandler(AppDeployedEvent)
export class AppDeployedHandler {
  async handle(event: AppDeployedEvent) {
    // Atualizar métricas
    // Notificar stakeholders
    // Trigger workflows
  }
}
```

### API Contracts

```typescript
// DTOs compartilhados
export interface DeployAppDto {
  name: string;
  imageRef: string;
  environment: string;
  resources?: {
    cpu: string;
    memory: string;
  };
}

// API responses
export interface DeployAppResponse {
  appId: string;
  status: 'deploying' | 'deployed' | 'failed';
  deploymentId: string;
}
```

## 🔒 Segurança

### Autenticação e Autorização

- **JWT Tokens** para autenticação
- **RBAC** por projeto/ambiente/serviço
- **mTLS** opcional para service-to-service
- **Vault** para gerenciamento de secrets

### Network Policies

```yaml
# Políticas de rede
- name: public-api
  ingress:
    - from: internet
      to: http:443
  egress:
    - to: dns
    - to: external-apis-whitelist

- name: internal-service
  ingress:
    - from: app-services-only
  egress:
    - to: broker
    - to: dns
```

## 📊 Observability

### Logging

```typescript
// Logging estruturado
export class Logger {
  info(message: string, context?: Record<string, any>) {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        service: 'capsule-api',
        ...context,
      })
    );
  }
}
```

### Métricas

- **Prometheus** para coleta de métricas
- **Grafana** para visualização
- **OpenTelemetry** para traces
- **Health checks** automáticos

### Health Checks

```typescript
// Health check endpoint
@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      checks: [
        {
          name: 'database',
          status: 'pass',
          latencyMs: 45,
        },
        {
          name: 'redis',
          status: 'pass',
          latencyMs: 12,
        },
      ],
    };
  }
}
```

## 🚀 Deploy e Infraestrutura

### Container Strategy

- **Multi-stage builds** para otimização
- **Non-root users** para segurança
- **Health checks** obrigatórios
- **Resource limits** configuráveis

### Service Discovery

- **DNS interno** (svc.internal)
- **Load balancing** automático
- **Circuit breakers** para resiliência
- **Retry policies** configuráveis

## 🔧 Configuração

### Environment Variables

```bash
# API Configuration
CAPSULE_API_URL=https://api.capsule.io
CAPSULE_API_KEY=your-api-key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/capsule

# Redis
REDIS_URL=redis://localhost:6379

# Vault
VAULT_URL=https://vault.capsule.io
VAULT_TOKEN=your-vault-token
```

### Configuration Files

```yaml
# capsule.yaml
app: myapp
services:
  - name: api
    image: ghcr.io/org/api:latest
    protocol: http
    port: 8080
    env:
      - NODE_ENV=production
    health:
      path: /health
      timeoutSec: 2
      intervalSec: 5
```

## 📈 Performance e Escalabilidade

### Caching Strategy

- **Redis** para cache distribuído
- **In-memory cache** para dados frequentes
- **CDN** para assets estáticos
- **Database connection pooling**

### Scaling Policies

```yaml
# Autoscaling configuration
scalingPolicy:
  type: cpu
  target: 70
  min: 2
  max: 8
  cooldownSec: 60
```

## 🔄 CI/CD Pipeline

### Stages

1. **Build** - Compilação e testes
2. **Preview** - Ambiente efêmero por PR
3. **Staging** - Validação antes de produção
4. **Production** - Deploy com canary/blue-green

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: capsule/setup-cli@v1
      - run: capsule deploy --env production
```

## 🧪 Testes

### Test Strategy

- **Unit tests** para lógica de negócio
- **Integration tests** para APIs
- **E2E tests** para fluxos críticos
- **Performance tests** para benchmarks

### Test Structure

```typescript
// Unit test example
describe('DeployAppUseCase', () => {
  it('should deploy app successfully', async () => {
    const useCase = new DeployAppUseCase(mockAppRepo, mockRegistry, mockRuntime, mockEventPublisher);

    const result = await useCase.execute({
      name: 'test-app',
      imageRef: 'ghcr.io/org/app:latest',
    });

    expect(result.name).toBe('test-app');
    expect(mockRuntime.deploy).toHaveBeenCalledWith(result);
  });
});
```

## 📚 Referências

- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Nx Documentation](https://nx.dev/)
- [NestJS Documentation](https://nestjs.com/)
