import React from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sharingErrorText } from '../../lib/sharing';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

/** Os quatro estados de uma lista: a carregar, com erro, vazia, ou com dados. */
export const QueryState: React.FC<QueryStateProps> = ({
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyHint,
  onRetry,
  children,
}) => {
  if (isLoading)
    return (
      <div className="space-y-3" role="status" aria-label="A carregar">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  if (error)
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {sharingErrorText(error)}
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Tentar outra vez
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  if (isEmpty)
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">{emptyTitle}</p>
        {emptyHint && <p className="max-w-md text-sm text-muted-foreground">{emptyHint}</p>}
      </div>
    );
  return <>{children}</>;
};
