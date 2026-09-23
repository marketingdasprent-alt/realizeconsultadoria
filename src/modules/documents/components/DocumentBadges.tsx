import React from 'react';
import { Badge } from '@/components/ui/badge';
import { DOCUMENT_STATUS_LABELS, getExpiryInfo } from '@/lib/documents';

export const DocumentStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variant =
    status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary';
  return (
    <Badge variant={variant} className="text-xs">
      {DOCUMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
};

export const ExpiryBadge: React.FC<{ expiryDate: string | null }> = ({ expiryDate }) => {
  const info = getExpiryInfo(expiryDate);
  if (info.state === 'none') return null;
  const className =
    info.state === 'expired'
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : info.state === 'expiring'
        ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200'
        : 'bg-green-50 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200';
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {info.label}
    </Badge>
  );
};
