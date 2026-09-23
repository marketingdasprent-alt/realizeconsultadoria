import React, { useRef } from 'react';
import { format } from 'date-fns';
import { Check, ExternalLink, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import type { EmployeeDocumentWithEmployee } from '../../services/documentService';

interface PayslipEmployeeRowProps {
  employee: { id: string; name: string; companies?: { name: string } | null };
  payslip: EmployeeDocumentWithEmployee | null;
  canImport: boolean;
  isUploading: boolean;
  onUpload: (file: File) => void;
}

/** Linha da lista de importação: estado do recibo do mês e botão de upload. */
export const PayslipEmployeeRow: React.FC<PayslipEmployeeRowProps> = ({
  employee,
  payslip,
  canImport,
  isUploading,
  onUpload,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const { openingId, open } = useDocumentDownload();

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{employee.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {payslip ? (
            <>
              <Check className="mr-1 inline h-3 w-3 text-green-600" />
              {payslip.file_name} · {format(new Date(payslip.created_at), 'dd/MM HH:mm')}
            </>
          ) : (
            <>Sem recibo{employee.companies?.name ? ` · ${employee.companies.name}` : ''}</>
          )}
        </p>
      </div>
      {payslip && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => open(payslip)}
          disabled={openingId === payslip.id}
          aria-label="Abrir recibo"
        >
          {openingId === payslip.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </Button>
      )}
      {canImport && (
        <>
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
          <Button
            variant={payslip ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => input.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1 h-4 w-4" />
            )}
            {payslip ? 'Substituir' : 'Importar'}
          </Button>
        </>
      )}
    </div>
  );
};
