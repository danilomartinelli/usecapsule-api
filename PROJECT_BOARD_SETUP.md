# 📊 Project Board Setup - Capsule Platform

## Configuração Manual do Project Board

Como criar o Project Board no GitHub:

1. **Acesse o repositório** em https://github.com/danilomartinelli/acme
2. **Clique na aba "Projects"**
3. **Clique em "New project"**
4. **Selecione "Board" como template**
5. **Configure com o nome**: "Capsule Platform Development"

## Estrutura Recomendada de Colunas

### 📋 Backlog
- Todas as issues não iniciadas
- Filtro: `is:open no:status`

### 🎯 Ready
- Issues prontas para desenvolvimento
- Filtro: `is:open label:P0,P1`

### 🚧 In Progress
- Issues em desenvolvimento ativo
- Limite: 3-5 issues por desenvolvedor

### 👀 In Review
- Issues aguardando code review
- Issues com PR aberto

### ✅ Done
- Issues completadas e merged
- Filtro: `is:closed`

## Automações Recomendadas

### Auto-add to project
- Quando: Issue criada
- Ação: Adicionar ao Backlog

### Auto-move to In Progress
- Quando: Issue assigned
- Ação: Mover para In Progress

### Auto-move to In Review
- Quando: PR linked
- Ação: Mover para In Review

### Auto-move to Done
- Quando: Issue closed
- Ação: Mover para Done

## Views Adicionais Sugeridas

### 📊 Sprint View
- Agrupar por: Milestone
- Filtrar por: Current sprint
- Ordenar por: Priority

### 🏷️ Priority View
- Agrupar por: Labels (P0, P1, P2, P3)
- Ordenar por: Created date

### 👥 Team View
- Agrupar por: Assignee
- Filtrar por: Open issues
- Mostrar: Story points

### 🎯 Microservice View
- Agrupar por: Labels (api-gateway, auth-service, etc.)
- Ordenar por: Priority

## Métricas para Acompanhar

### Velocity
- Story points completados por sprint
- Meta: 30-40 points/sprint

### Cycle Time
- Tempo médio de "In Progress" até "Done"
- Meta: < 3 dias

### WIP (Work in Progress)
- Issues em "In Progress" simultaneamente
- Limite: 5-7 issues

### Burndown
- Story points restantes por sprint
- Visualizar progresso diário

## Links Úteis

- [GitHub Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [Project Automation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project)
- [Project Views](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project)

## Comando para listar issues por status

```bash
# Backlog (não iniciadas)
gh issue list --label P0,P1 --limit 20

# In Progress (com assignee)
gh issue list --assignee @me

# Closed (últimas completadas)
gh issue list --state closed --limit 10
```

## Integração com CLI

Depois de criar o project, você pode gerenciá-lo via CLI:

```bash
# Listar projects
gh project list --owner danilomartinelli

# Ver status do project
gh project view [PROJECT_NUMBER]

# Adicionar issue ao project
gh project item-add [PROJECT_NUMBER] --owner danilomartinelli --url [ISSUE_URL]
```

---

*Após criar o Project Board, delete este arquivo ou mova para docs/*