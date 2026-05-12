// src/lib/schemas.ts
// Schemas de validação Zod centralizados para formulários

import * as z from 'zod';

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  password: z
    .string()
    .min(1, 'Password é obrigatória')
    .min(6, 'Password deve ter pelo menos 6 caracteres'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação de password é obrigatória'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'As passwords não coincidem',
    path: ['confirmPassword'],
  });

// ─── Empresa ─────────────────────────────────────────────────────────────────

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  nif: z
    .string()
    .min(9, 'NIF deve ter 9 dígitos')
    .max(9, 'NIF deve ter 9 dígitos')
    .regex(/^\d+$/, 'NIF deve conter apenas dígitos'),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable().default('Portugal'),
  domain: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const updateCompanySchema = createCompanySchema.partial();

// ─── Colaborador ─────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().min(1, 'Email é obrigatório').email('Email inválido'),
  phone: z.string().optional().nullable(),
  company_id: z.string().uuid('Empresa inválida'),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  hire_date: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  document_number: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

// ─── Ausência ─────────────────────────────────────────────────────────────────

export const createAbsenceSchema = z
  .object({
    employee_id: z.string().uuid('Colaborador inválido'),
    company_id: z.string().uuid('Empresa inválida'),
    absence_type: z.string().min(1, 'Tipo de ausência é obrigatório'),
    start_date: z.string().min(1, 'Data de início é obrigatória'),
    end_date: z.string().min(1, 'Data de fim é obrigatória'),
    notes: z.string().optional().nullable(),
  })
  .refine(data => new Date(data.end_date) >= new Date(data.start_date), {
    message: 'Data de fim deve ser posterior ou igual à data de início',
    path: ['end_date'],
  });

export const rejectAbsenceSchema = z.object({
  rejection_reason: z.string().min(10, 'Motivo de rejeição deve ter pelo menos 10 caracteres'),
});

// ─── Ticket de Suporte ───────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  subject: z.string().min(5, 'Assunto deve ter pelo menos 5 caracteres'),
  message: z.string().min(10, 'Mensagem deve ter pelo menos 10 caracteres'),
  department_id: z.string().uuid('Departamento inválido'),
  employee_id: z.string().uuid('Colaborador inválido'),
  company_id: z.string().uuid('Empresa inválida'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1, 'Mensagem não pode estar vazia'),
});

// ─── Tipos inferidos ─────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type CreateAbsenceInput = z.infer<typeof createAbsenceSchema>;
export type RejectAbsenceInput = z.infer<typeof rejectAbsenceSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;
