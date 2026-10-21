import React, { useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { generatePassword } from '../../../lib/credentials';
import { CopyButton } from '../SecretText';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Palavra-passe com mostrar, gerar uma forte e copiar. */
export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  value,
  onChange,
  placeholder,
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-10 font-mono"
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
        aria-label={visible ? 'Esconder' : 'Mostrar'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={() => {
          onChange(generatePassword());
          setVisible(true);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-primary"
        aria-label="Gerar palavra-passe"
        title="Gerar palavra-passe"
      >
        <Wand2 className="h-4 w-4" />
      </button>
      {value && <CopyButton value={value} label="Copiar palavra-passe" />}
    </div>
  );
};
