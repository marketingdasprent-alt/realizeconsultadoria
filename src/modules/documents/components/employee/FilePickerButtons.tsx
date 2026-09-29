import React from 'react';
import { Camera, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface FilePickerButtonsProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

/** "Tirar foto" (câmara traseira) ou escolher ficheiro/PDF, em botões grandes. */
export const FilePickerButtons: React.FC<FilePickerButtonsProps> = ({ file, onChange }) => (
  <div className="space-y-2">
    <Label>Ficheiro *</Label>
    <div className="grid grid-cols-2 gap-2">
      <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-medium">
        <Camera className="h-4 w-4" /> Tirar foto
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-medium">
        <Upload className="h-4 w-4" /> Escolher ficheiro
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
    {file && <p className="truncate text-xs text-muted-foreground">{file.name}</p>}
  </div>
);
