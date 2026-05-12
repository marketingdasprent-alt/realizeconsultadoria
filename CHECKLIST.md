CHECKLIST DE VERIFICAÇÃO - REALIZE CONSULTADORIA
Guia rápido para validação de melhorias


📋 CHECKLIST RÁPIDO (15 MINUTOS)
═══════════════════════════════════════════════════════════════════════════

Antes de começar qualquer desenvolvimento:

SETUP
[ ] npm install foi executado
[ ] .env.local existe com variáveis necessárias
[ ] npm run dev funciona em http://localhost:3000
[ ] Não há erros no console do navegador

AUTENTICAÇÃO
[ ] Página de login admin acessível em /admin/login
[ ] Página de login employee acessível em /colaborador/login
[ ] Login com credenciais válidas redireciona para dashboard
[ ] Login com credenciais inválidas mostra erro
[ ] Logout funciona e redireciona para home
[ ] Session persiste ao recarregar página
[ ] Logado user não consegue acessar /admin/login

ROTAS
[ ] / redireciona para home
[ ] /admin/login acessível sem auth
[ ] /admin requer autenticação admin
[ ] /colaborador requer autenticação employee
[ ] Rotas inválidas mostram 404
[ ] Rotas protegidas redirecionam para login

SEGURANÇA
[ ] Nenhum console.log em componentes produção
[ ] Nenhum hardcoded secret/key visível
[ ] localStorage não armazena tokens
[ ] HTTPS em produção (verificar em Vercel)
[ ] CORS configurado corretamente

UI/UX
[ ] Todas as páginas têm loading state
[ ] Todas as ações têm feedback (toast)
[ ] Formulários têm validação
[ ] Mensagens de erro são úteis
[ ] Mobile é responsivo


📊 CHECKLIST DE CÓDIGO (ANTES DE COMMIT)
═══════════════════════════════════════════════════════════════════════════

Para cada novo arquivo/modificação:

ESTRUTURA
[ ] Arquivo está no local correto (seguir estrutura modular)
[ ] Imports estão organizados (React, libs, shared, modules)
[ ] Arquivo exporta corretamente (default/named exports)
[ ] Não há circular imports

TYPESCRIPT
[ ] Sem uso de 'any' type
[ ] Todos os props têm type annotation
[ ] Funções têm tipos de entrada e saída
[ ] Enums/constants têm tipos
[ ] Objects têm interfaces/types

FUNCIONALIDADE
[ ] Código não tem TODOs deixados
[ ] Variáveis têm nomes descritivos
[ ] Funções fazem apenas uma coisa (SRP)
[ ] Não há código duplicado
[ ] Error handling está implementado

PERFORMANCE
[ ] Sem re-renders desnecessários (memo, useCallback)
[ ] Sem dados sensíveis em console
[ ] Query strings otimizadas
[ ] Lazy loading onde apropriado
[ ] Sem memory leaks (cleanup em useEffect)

ACESSIBILIDADE
[ ] Botões têm label/aria-label
[ ] Formulários têm labels
[ ] Cores contrastam adequadamente
[ ] Navegação por teclado funciona
[ ] Imagens têm alt text

TESTES
[ ] Caso de sucesso foi testado manualmente
[ ] Caso de erro foi testado
[ ] Edge cases foram considerados
[ ] Teste em mobile/tablet
[ ] Teste em diferentes browsers


🔍 CHECKLIST DE REVISÃO (PULL REQUEST)
═══════════════════════════════════════════════════════════════════════════

Revisor deve verificar:

CODE QUALITY
[ ] Código segue padrões definidos
[ ] Sem console.log/error desnecessários
[ ] Nomes são descritivos
[ ] Complexidade ciclomática é baixa
[ ] DRY principle foi seguido

TESTE & COVERAGE
[ ] Mudanças têm testes correspondentes
[ ] Testes passam localmente
[ ] Coverage não diminuiu
[ ] Edge cases estão testados
[ ] Error handling está testado

DOCUMENTAÇÃO
[ ] JSDoc foi adicionado para funções públicas
[ ] Variáveis complexas têm comentários
[ ] Mudanças em APIs foram documentadas
[ ] Migrations foram documentadas

SEGURANÇA
[ ] Sem secrets commitados
[ ] RLS policies são apropriadas
[ ] Rate limiting foi considerado
[ ] Inputs são validados
[ ] SQL injection não é possível

PERFORMANCE
[ ] Não há regressão de performance
[ ] Bundle size não aumentou significativamente
[ ] Database queries são otimizadas
[ ] Lazy loading foi implementado onde apropriado

UX/DESIGN
[ ] UI é consistente com design system
[ ] Responsivo em mobile/tablet/desktop
[ ] Acessibilidade foi considerada
[ ] Loading states são apropriados
[ ] Mensagens de erro são úteis

COMPATIBILIDADE
[ ] Funciona em Chrome/Firefox/Safari/Edge
[ ] Funciona em versões antigas de browsers
[ ] TypeScript compila sem erros
[ ] Build para produção funciona


✅ CHECKLIST PRÉ-DEPLOY
═══════════════════════════════════════════════════════════════════════════

Antes de fazer deploy para produção:

TESTES FINAIS
[ ] npm run build funciona
[ ] npm run lint passa sem erros
[ ] npm run test passou com 70%+ coverage
[ ] npm run preview funciona em localhost
[ ] Teste manual em http://localhost:3000
[ ] Teste de todos os flows principais
[ ] Teste em mobile/tablet
[ ] Teste em diferentes browsers

SEGURANÇA
[ ] npm audit passou (sem vulnerabilidades high)
[ ] Variáveis de ambiente estão corretas
[ ] Secrets não estão commitados
[ ] RLS policies estão ativas
[ ] Rate limiting está funcionando

PERFORMANCE
[ ] Lighthouse score > 80
[ ] Time to Interactive < 3s
[ ] Bundle size verificado
[ ] Imagens estão otimizadas
[ ] CSS/JS estão minificados

DADOS
[ ] Backup de database foi feito
[ ] Migrations foram testadas
[ ] Data migration script (se necessário) foi testado
[ ] Rollback plan foi documentado

DOCUMENTAÇÃO
[ ] README foi atualizado
[ ] CHANGELOG foi atualizado
[ ] Variáveis de ambiente foram documentadas
[ ] Setup de novo dev foi testado

RELEASE
[ ] Version foi bumpado (semantic versioning)
[ ] Tags de git foram criadas
[ ] Release notes foram escritas
[ ] Stakeholders foram notificados
[ ] Plano de rollback está pronto


🐛 CHECKLIST DE DEBUGGING
═══════════════════════════════════════════════════════════════════════════

Quando algo não funciona:

SETUP
[ ] node_modules foi deletado e npm install foi executado
[ ] npm cache clean foi executado
[ ] Browser cache foi limpo
[ ] Vercel cache foi limpo (se em produção)
[ ] .env.local está correto

REDE
[ ] API está respondendo (curl/Postman)
[ ] CORS está configurado
[ ] Headers estão corretos
[ ] Status code é o esperado
[ ] Response body é o esperado

AUTH
[ ] Token é válido (verificar em jwt.io)
[ ] Token não expirou
[ ] Refresh token está funcionando
[ ] RLS policy está correta
[ ] User tem permissões necessárias

BASE DE DADOS
[ ] Tabela existe
[ ] Coluna existe
[ ] Dados existem
[ ] RLS policy permite acesso
[ ] Índices estão criados (performance)

CLIENTE
[ ] Console.log adicional mostra valores corretos
[ ] Estado do React está correto (React DevTools)
[ ] Network tab mostra requisição correta
[ ] Response é parseado corretamente
[ ] Componente re-rendendo incorretamente?

LOGS
[ ] Verificar server logs (Vercel, Supabase)
[ ] Verificar browser console errors
[ ] Verificar network errors
[ ] Verificar application errors
[ ] Procurar por patterns de erro


📊 CHECKLIST DE MEETING/REVIEW SEMANAL
═══════════════════════════════════════════════════════════════════════════

Cada sexta-feira ou antes de reunião de status:

PROGRESSO
[ ] Sprint goals foram atingidos?
[ ] Blockers foram documentados?
[ ] Próximas prioridades estão claras?
[ ] Estimates foram acurados?

QUALIDADE
[ ] Nenhum bug crítico encontrado?
[ ] Performance está aceitável?
[ ] Coverage de testes está aumentando?
[ ] Dívida técnica foi reduzida?

SEGURANÇA
[ ] Nenhuma vulnerabilidade encontrada?
[ ] RLS policies foram auditadas?
[ ] Secrets estão seguros?
[ ] Access controls funcionando?

COMUNICAÇÃO
[ ] Documentação foi atualizada?
[ ] Decisões foram comunicadas?
[ ] Stakeholders foram atualizados?
[ ] Issues foram fechadas com explicação?

PRÓXIMOS PASSOS
[ ] Backlog foi priorizado?
[ ] Próximo sprint foi planejado?
[ ] Recursos necessários foram alocados?
[ ] Riscos foram identificados?


🎯 CHECKLIST FINAL - ANTES DE APRESENTAR AO CLIENTE
═══════════════════════════════════════════════════════════════════════════

FUNCIONALIDADES
[ ] Todos os requirements foram implementados
[ ] Nenhuma regressão foi introduzida
[ ] Testes de aceitação passam
[ ] Demo funciona sem erros
[ ] Dados de exemplo fazem sentido

QUALIDADE
[ ] Código é legível e bem documentado
[ ] Performance está boa (testes de carga)
[ ] Sem bugs conhecidos
[ ] Segurança foi validada
[ ] Acessibilidade foi testada

UX/DESIGN
[ ] UI é polido e profissional
[ ] Mensagens ao user são claras
[ ] Fluxos são intuitivos
[ ] Mobile funciona bem
[ ] Consistência visual

SUPORTE
[ ] Documentação foi preparada
[ ] Troubleshooting guide foi criado
[ ] FAQ foi preparado
[ ] Support team foi treinado
[ ] Processo de reporting de bugs foi definido

DEPLOYMENT
[ ] Build foi feito com sucesso
[ ] Deployment foi testado
[ ] Rollback plan foi documentado
[ ] Monitoring foi configurado
[ ] Alerts foram setadas


═══════════════════════════════════════════════════════════════════════════

Usar estes checklists para garantir qualidade enterprise.
Adaptar conforme necessidade específica do projeto.

Última atualização: 2026-05-11
