# API Gateway

## Backend for Frontend (BFF)

O API Gateway é o ponto único de entrada HTTP para toda a plataforma Capsule, responsável por rotear requisições, autenticação e agregação de dados dos microserviços.

### Responsabilidades

- **Roteamento**: Direciona requisições para os microserviços apropriados via RabbitMQ
- **Autenticação/Autorização**: Valida tokens JWT e API Keys
- **Rate Limiting**: Controle de taxa de requisições por cliente
- **Documentação**: Swagger/OpenAPI automático em `/api/documentation`
- **Agregação**: Combina respostas de múltiplos microserviços quando necessário
- **WebSockets**: Suporte a conexões em tempo real para logs e eventos

### Arquitetura

```
HTTP/WebSocket Request
        ↓
   API Gateway
        ↓
  [RabbitMQ Bus]
    ↙   ↓   ↘
Auth  Deploy Monitor
Service Service Service
```

### Endpoints Principais

#### Públicos (Sem Autenticação)
- `GET /health` - Health check
- `GET /api/documentation` - Swagger UI
- `GET /api/documentation.json` - OpenAPI spec

#### Token-based (API Key)
- SDK e integração com CI/CD
- Webhooks e callbacks

#### Privados (JWT)
- Dashboard e admin
- Operações sensíveis

### Configuração

```typescript
// Variáveis de ambiente necessárias
RABBITMQ_URL=amqp://localhost:5672
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=3000
```

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Desenvolvimento
nx serve api-gateway

# Build para produção
nx build api-gateway

# Testes
nx test api-gateway
```

### Comunicação com Microserviços

Todos os microserviços são acessados exclusivamente via RabbitMQ:

```typescript
// Exemplo de chamada para auth-service
this.client.send('auth.validate', { email, password })
```

### Tecnologias

- NestJS 11
- RabbitMQ (microservices)
- Redis (cache/rate limiting)
- Swagger/OpenAPI
- JWT/Passport
- GraphQL (opcional)