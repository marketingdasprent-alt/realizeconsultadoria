import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

interface AdminLoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent, password: string) => void;
  onForgotPasswordClick: () => void;
}

export const AdminLoginForm = ({
  email,
  setEmail,
  isLoading,
  onSubmit,
  onForgotPasswordClick,
}: AdminLoginFormProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e, password);
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Área de Administração</h1>
      <p className="text-muted-foreground mb-8">
        Insira as suas credenciais para aceder ao painel.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@empresa.pt"
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={onForgotPasswordClick}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Esqueceu-se da password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />A entrar...
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>
    </>
  );
};
