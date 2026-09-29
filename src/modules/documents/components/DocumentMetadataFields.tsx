import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAYSLIP_CATEGORY, getDocumentCategory, type DocumentCategory } from '@/lib/documents';
import type { DocumentMetadata } from '../hooks/useDocumentMetadata';

interface DocumentMetadataFieldsProps {
  categories: DocumentCategory[];
  value: DocumentMetadata;
  onChange: (patch: Partial<DocumentMetadata>) => void;
  /** Mostrar "Emitido em" (BackOffice). */
  showIssueDate?: boolean;
  /** Campos mais altos para o telemóvel. */
  tall?: boolean;
  idPrefix?: string;
}

/** Tipo de documento + nº / datas / mês, conforme o tipo. */
export const DocumentMetadataFields: React.FC<DocumentMetadataFieldsProps> = ({
  categories,
  value,
  onChange,
  showIssueDate = false,
  tall = false,
  idPrefix = 'doc',
}) => {
  const info = getDocumentCategory(value.category);
  const h = tall ? 'h-11' : undefined;
  const dateField = (
    key: 'issueDate' | 'expiryDate' | 'periodMonth',
    label: string,
    type: 'date' | 'month'
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        type={type}
        className={h}
        value={value[key]}
        onChange={e => onChange({ [key]: e.target.value })}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-1">
        <Label>Tipo de documento *</Label>
        <Select value={value.category} onValueChange={category => onChange({ category })}>
          <SelectTrigger className={h}>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {info?.unique && showIssueDate && (
          <p className="text-xs text-muted-foreground">
            Substitui o documento atual deste tipo, se existir.
          </p>
        )}
      </div>
      {info?.hasNumber && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-number`}>Número do documento</Label>
          <Input
            id={`${idPrefix}-number`}
            className={h}
            value={value.documentNumber}
            onChange={e => onChange({ documentNumber: e.target.value })}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {showIssueDate && dateField('issueDate', 'Emitido em', 'date')}
        {info?.hasExpiry && dateField('expiryDate', 'Válido até', 'date')}
        {value.category === PAYSLIP_CATEGORY &&
          dateField('periodMonth', 'Mês do recibo *', 'month')}
      </div>
    </>
  );
};
