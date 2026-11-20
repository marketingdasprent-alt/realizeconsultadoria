import { test, expect, type Page, type Route } from '@playwright/test';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PEER_AUTHOR_ID = '22222222-2222-4222-8222-222222222222';
const PEER_COMMENTER_ID = '33333333-3333-4333-8333-333333333333';
const OWN_AUTHOR_ID = '44444444-4444-4444-8444-444444444444';
const OWN_COMPANY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PEER_COMPANY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OWN_POST_ID = 'post-own-1';
const PEER_POST_ID = 'post-peer-1';

const MOCK_USER = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'ana@empresa-a.pt',
  user_metadata: { name: 'Ana Silva' },
  app_metadata: { provider: 'email' },
  created_at: '2025-01-01T00:00:00Z',
};

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const setupFeedMocks = async (page: Page) => {
  let ownReactions = [{ emoji: '👍', count: 1, mine: false }];
  const ownComments = [
    {
      id: 'comment-own-1',
      post_id: OWN_POST_ID,
      author_id: OWN_AUTHOR_ID,
      body: 'Comentário da própria empresa',
      mentions: [],
      parent_id: null,
      created_at: '2026-11-20T10:05:00Z',
      deleted_at: null,
    },
  ];
  const peerComments = [
    {
      id: 'comment-peer-1',
      post_id: PEER_POST_ID,
      author_id: PEER_COMMENTER_ID,
      body: 'Excelente partilha do grupo!',
      mentions: [],
      parent_id: null,
      created_at: '2026-11-20T10:10:00Z',
      deleted_at: null,
    },
  ];

  // Bloqueia WebSockets do Supabase Realtime para não atrasar nem gerar erros de rede em CI.
  await page.routeWebSocket('**/*.supabase.co/**', ws => {
    ws.onMessage(() => {});
  });

  await page.route('**/*.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith('/auth/v1/token')) {
      return fulfillJson(route, {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock-refresh-token',
        user: MOCK_USER,
      });
    }

    if (path.endsWith('/auth/v1/user')) {
      return fulfillJson(route, MOCK_USER);
    }

    if (path.endsWith('/auth/v1/logout')) {
      return fulfillJson(route, {});
    }

    if (path.endsWith('/rest/v1/employees')) {
      const accept = request.headers()['accept'] ?? '';
      const employee = {
        id: 'emp-1',
        user_id: USER_ID,
        company_id: OWN_COMPANY_ID,
        name: 'Ana Silva',
        email: 'ana@empresa-a.pt',
        position: 'Consultora',
        department: 'RH',
        hire_date: '2024-01-10',
        is_active: true,
        companies: { name: 'Empresa A' },
      };
      return fulfillJson(
        route,
        accept.includes('application/vnd.pgrst.object+json') ? employee : [employee]
      );
    }

    if (path.endsWith('/rest/v1/user_roles')) {
      const accept = request.headers()['accept'] ?? '';
      const roleRow = { role: 'employee' };
      return fulfillJson(
        route,
        accept.includes('application/vnd.pgrst.object+json') ? roleRow : [roleRow]
      );
    }

    if (path.endsWith('/rest/v1/rpc/chat_directory')) {
      return fulfillJson(route, [
        {
          user_id: USER_ID,
          name: 'Ana Silva',
          position: 'Consultora',
          department: 'RH',
          email: 'ana@empresa-a.pt',
          avatar_path: null,
        },
        {
          user_id: OWN_AUTHOR_ID,
          name: 'Bruno Costa',
          position: 'Técnico',
          department: 'IT',
          email: 'bruno@empresa-a.pt',
          avatar_path: null,
        },
      ]);
    }

    if (path.endsWith('/rest/v1/rpc/feed_list_posts')) {
      return fulfillJson(route, [
        {
          id: OWN_POST_ID,
          company_id: OWN_COMPANY_ID,
          company_name: 'Empresa A',
          author_id: OWN_AUTHOR_ID,
          author_name: 'Bruno Costa',
          body: 'Publicação interna da Empresa A',
          audience: 'company',
          department: null,
          attachments: [],
          mentions: [],
          kind: 'post',
          subject_id: null,
          created_at: '2026-11-20T10:00:00Z',
          edited_at: null,
          comment_count: ownComments.length,
          reactions: ownReactions,
        },
        {
          id: PEER_POST_ID,
          company_id: PEER_COMPANY_ID,
          company_name: 'Empresa Par',
          author_id: PEER_AUTHOR_ID,
          author_name: 'Carlos Mendes',
          body: 'Publicação partilhada da Empresa Par',
          audience: 'company',
          department: null,
          attachments: [],
          mentions: [],
          kind: 'post',
          subject_id: null,
          created_at: '2026-11-20T09:50:00Z',
          edited_at: null,
          comment_count: peerComments.length,
          reactions: [{ emoji: '🎉', count: 2, mine: false }],
        },
      ]);
    }

    if (path.endsWith('/rest/v1/rpc/feed_post_people')) {
      return fulfillJson(route, [
        { user_id: PEER_AUTHOR_ID, name: 'Carlos Mendes', company_name: 'Empresa Par' },
        { user_id: PEER_COMMENTER_ID, name: 'Diogo Alves', company_name: 'Empresa Par' },
      ]);
    }

    if (path.endsWith('/rest/v1/feed_comments')) {
      if (method === 'POST') {
        const payload = JSON.parse(request.postData() ?? '{}') as {
          post_id: string;
          author_id: string;
          body: string;
        };
        ownComments.push({
          id: `comment-own-${ownComments.length + 1}`,
          post_id: payload.post_id,
          author_id: payload.author_id,
          body: payload.body,
          mentions: [],
          parent_id: null,
          created_at: new Date().toISOString(),
          deleted_at: null,
        });
        return fulfillJson(route, [], 201);
      }
      const postIdFilter = url.searchParams.get('post_id') ?? '';
      return fulfillJson(route, postIdFilter.includes(PEER_POST_ID) ? peerComments : ownComments);
    }

    if (path.endsWith('/rest/v1/feed_reactions')) {
      if (method === 'POST') {
        ownReactions = [
          { emoji: '👍', count: 1, mine: false },
          { emoji: '❤️', count: 1, mine: true },
        ];
        return fulfillJson(route, [], 201);
      }
      return fulfillJson(route, []);
    }

    if (path.endsWith('/rest/v1/rpc/feed_unread_count')) {
      return fulfillJson(route, 0);
    }

    return fulfillJson(route, []);
  });
};

test.describe('Feed por grupo', () => {
  test('mostra posts da própria empresa e de pares em só leitura, e alterna o filtro de âmbito', async ({
    page,
  }) => {
    await setupFeedMocks(page);

    // Login simulado via UI para gravar a sessão na chave real do cliente Supabase
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).fill('ana@empresa-a.pt');
    await page.getByLabel('Palavra-passe', { exact: true }).fill('SenhaTeste123!');
    await page.getByRole('button', { name: /entrar/i }).click();

    await page.waitForURL('**/colaborador**');
    await page.goto('/colaborador/feed');

    const ownPost = page.locator(`#post-${OWN_POST_ID}`);
    const peerPost = page.locator(`#post-${PEER_POST_ID}`);

    await expect(ownPost).toBeVisible();
    await expect(peerPost).toBeVisible();

    // Post de empresa par: etiqueta da empresa e autor "Nome - Empresa"
    await expect(peerPost.locator('[data-company-badge]')).toHaveText('Empresa Par');
    await expect(peerPost).toContainText('Carlos Mendes - Empresa Par');

    // Post de empresa par está em modo só leitura (sem reagir, sem eliminar, sem input de comentário)
    await expect(peerPost.getByRole('button', { name: 'Reagir' })).toHaveCount(0);
    await expect(peerPost.getByRole('button', { name: 'Opções da publicação' })).toHaveCount(0);
    await peerPost.getByRole('button', { name: '1 comentário' }).click();
    await expect(peerPost).toContainText('Diogo Alves - Empresa Par');
    await expect(peerPost).toContainText('Excelente partilha do grupo!');
    await expect(peerPost.getByPlaceholder(/Escreva um comentário/i)).toHaveCount(0);
    await expect(peerPost.getByRole('button', { name: 'Responder' })).toHaveCount(0);

    // Post da própria empresa permite reagir e comentar
    await expect(ownPost.getByRole('button', { name: 'Reagir' })).toBeVisible();
    await ownPost.getByRole('button', { name: 'Reagir' }).click();
    await page.getByRole('button', { name: '❤️' }).click();
    await expect(ownPost.getByRole('button', { name: /❤️ 1/ })).toBeVisible();

    await ownPost.getByRole('button', { name: /1 comentário/ }).click();
    const commentInput = ownPost.getByPlaceholder(/Escreva um comentário/i);
    await expect(commentInput).toBeVisible();
    await commentInput.fill('Novo comentário na própria empresa');
    await ownPost.getByRole('button', { name: 'Comentar' }).click();
    await expect(ownPost).toContainText('Novo comentário na própria empresa');

    // Filtro "Todas as empresas" vs "Só a minha empresa" alterna visibilidade dos posts de pares
    const allCompaniesBtn = page.getByRole('button', { name: 'Todas as empresas' });
    const myCompanyBtn = page.getByRole('button', { name: 'Só a minha empresa' });
    await expect(allCompaniesBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(myCompanyBtn).toHaveAttribute('aria-pressed', 'false');

    await myCompanyBtn.click();
    await expect(myCompanyBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(ownPost).toBeVisible();
    await expect(peerPost).toHaveCount(0);

    await allCompaniesBtn.click();
    await expect(allCompaniesBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(peerPost).toBeVisible();
  });
});
