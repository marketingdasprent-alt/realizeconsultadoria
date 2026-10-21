import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Field } from '../FormSection';

interface EmployeeAccessFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  errors: FieldErrors;
  password: string;
}

/** Só ao criar: senha inicial da app e dias de férias do ano. */
export const EmployeeAccessFields = ({ register, errors, password }: EmployeeAccessFieldsProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Field
      label="Senha inicial *"
      error={
        (errors.password?.message as string | undefined) ??
        (password.length > 0 && password.length < 8
          ? 'Senha deve ter pelo menos 8 caracteres'
          : undefined)
      }
      hint="Enviada ao colaborador por email."
    >
      <Input type="password" {...register('password')} placeholder="Mínimo 8 caracteres" />
    </Field>
    <Field label="Confirmar senha *" error={errors.confirmPassword?.message as string | undefined}>
      <Input type="password" {...register('confirmPassword')} placeholder="Repita a senha" />
    </Field>
    <Field label="Dias de férias (este ano)">
      <Input type="number" {...register('vacation_days')} />
    </Field>
    <Field label="Dias que o próprio pode marcar" hint="Vazio = pode marcar todos.">
      <Input type="number" {...register('self_schedulable_days')} />
    </Field>
  </div>
);
