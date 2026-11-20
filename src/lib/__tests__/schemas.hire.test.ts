import { describe, expect, it } from 'vitest';
import { createEmployeeSchema, updateEmployeeSchema } from '../schemas';

const base = {
  name: 'Ana Silva',
  email: 'ana@exemplo.pt',
  company_id: '11111111-1111-4111-8111-111111111111',
  password: 'palavra-passe-1',
  confirmPassword: 'palavra-passe-1',
};

describe('data de admissão', () => {
  it('é obrigatória ao criar', () => {
    const result = createEmployeeSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['hire_date']);
    expect(createEmployeeSchema.safeParse({ ...base, hire_date: '' }).success).toBe(false);
  });

  it('aceita a criação com admissão', () => {
    expect(createEmployeeSchema.safeParse({ ...base, hire_date: '2026-11-20' }).success).toBe(true);
  });

  it('continua opcional ao editar', () => {
    expect(updateEmployeeSchema.safeParse({ name: 'Ana Silva' }).success).toBe(true);
  });
});
