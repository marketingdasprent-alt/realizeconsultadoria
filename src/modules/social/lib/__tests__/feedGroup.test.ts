import { describe, expect, it } from 'vitest';
import type { FeedPostRow } from '../../services/feedService';
import type { FeedPost } from '../../types';
import { filterByScope, hasOtherCompanyPosts, personLabel, toPost } from '../feed';

const row = (overrides: Partial<FeedPostRow> = {}): FeedPostRow =>
  ({
    id: 'p1',
    author_id: 'u2',
    body: 'Olá',
    audience: 'company',
    department: null,
    attachments: [],
    created_at: '2026-11-20T10:00:00Z',
    edited_at: null,
    comment_count: 0,
    reactions: [],
    kind: 'post',
    subject_id: null,
    mentions: [],
    ...overrides,
  }) as FeedPostRow;

const nameOf = (id: string | null) => (id === 'u1' ? 'Eu' : 'Antigo colaborador');
const byId = new Map();

describe('toPost — empresa do grupo', () => {
  it('publicação de outra empresa: etiqueta, autor pelo nome da resposta e sem ser minha', () => {
    const post = toPost(
      row({ company_id: 'c2', company_name: 'Empresa B', author_name: 'Ana B' }),
      'u1',
      nameOf,
      byId,
      'c1'
    );
    expect(post.isOtherCompany).toBe(true);
    expect(post.companyName).toBe('Empresa B');
    expect(post.authorName).toBe('Ana B - Empresa B');
    expect(post.authorRole).toBe('Empresa B');
    expect(post.isMine).toBe(false);
  });

  it('publicação da minha empresa não é de outra', () => {
    const post = toPost(
      row({ company_id: 'c1', company_name: 'Empresa A' }),
      'u1',
      nameOf,
      byId,
      'c1'
    );
    expect(post.isOtherCompany).toBe(false);
    expect(post.companyName).toBe('Empresa A');
  });

  it('tolera a resposta sem company_id nem company_name (base antiga)', () => {
    const post = toPost(row(), 'u1', nameOf, byId, 'c1');
    expect(post.isOtherCompany).toBe(false);
    expect(post.companyId).toBeNull();
    expect(post.companyName).toBeNull();
    expect(post.authorName).toBe('Antigo colaborador');
  });

  it('sem saber a minha empresa nada é marcado como de outra', () => {
    const post = toPost(row({ company_id: 'c2', company_name: 'Empresa B' }), 'u1', nameOf, byId);
    expect(post.isOtherCompany).toBe(false);
  });
});

describe('filtro Todas / Só a minha empresa', () => {
  const mine = { id: 'a', isOtherCompany: false } as FeedPost;
  const other = { id: 'b', isOtherCompany: true } as FeedPost;
  const legacy = { id: 'c' } as FeedPost;

  it('só aparece se houver publicações de outras empresas', () => {
    expect(hasOtherCompanyPosts([mine, legacy])).toBe(false);
    expect(hasOtherCompanyPosts([mine, other])).toBe(true);
  });

  it('"Só a minha empresa" tira as de outras empresas; "Todas" deixa tudo', () => {
    expect(filterByScope([mine, other, legacy], 'mine').map(p => p.id)).toEqual(['a', 'c']);
    expect(filterByScope([mine, other, legacy], 'all').map(p => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('personLabel', () => {
  it('"Nome - Empresa"', () => {
    expect(personLabel('Beatriz Matias', 'Razão Dinâmica')).toBe('Beatriz Matias - Razão Dinâmica');
  });
  it('sem empresa fica só o nome', () => {
    expect(personLabel('Beatriz Matias', null)).toBe('Beatriz Matias');
  });
});
