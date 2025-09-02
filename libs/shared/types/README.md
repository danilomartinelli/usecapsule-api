# @libs/shared/types

## TypeScript Type Definitions

Biblioteca de tipos TypeScript compartilhados entre todos os microserviços e a API Gateway.

### Propósito

- **Interfaces comuns**: Define interfaces e tipos reutilizáveis
- **Enums globais**: Centraliza enumerações usadas em múltiplos serviços
- **Type Guards**: Funções auxiliares para validação de tipos
- **Utility Types**: Tipos utilitários customizados do projeto

### Estrutura Esperada

```
types/
├── auth/
│   ├── user.interface.ts
│   ├── roles.enum.ts
│   └── permissions.type.ts
├── events/
│   ├── rabbitmq.interface.ts
│   └── event-patterns.enum.ts
├── common/
│   ├── api-response.type.ts
│   └── pagination.interface.ts
└── index.ts
```

### Uso

```typescript
import { User, UserRole, ApiResponse } from '@libs/shared/types';

// Interfaces
const user: User = {
  id: '123',
  email: 'user@example.com',
  role: UserRole.ADMIN
};

// Type Guards
if (isValidUser(data)) {
  // data é do tipo User
}

// Utility Types
type UserUpdate = PartialExcept<User, 'id'>;
```

### Convenções

- Interfaces para estruturas de dados
- Types para unions, intersections e aliases
- Enums para valores fixos e conhecidos
- Exportar tudo através do index.ts principal