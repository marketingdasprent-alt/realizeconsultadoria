import { useCallback, useRef, useState, type DragEvent } from 'react';

const hasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files');

/**
 * Largar ficheiros numa área (Messenger, email…). Devolve as props para o contentor e se
 * há ficheiros a ser arrastados por cima (para mostrar o aviso). Um contador evita que o
 * aviso pisque ao passar por cima dos elementos de dentro.
 */
export const useFileDrop = (onFiles: (files: File[]) => void, enabled = true) => {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  const reset = () => {
    depth.current = 0;
    setIsDragging(false);
  };

  const onDragEnter = useCallback(
    (event: DragEvent) => {
      if (!enabled || !hasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setIsDragging(true);
    },
    [enabled]
  );

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (!enabled || !hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [enabled]
  );

  const onDragLeave = useCallback(
    (event: DragEvent) => {
      if (!enabled || !hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsDragging(false);
    },
    [enabled]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!enabled || !hasFiles(event)) return;
      event.preventDefault();
      reset();
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length) onFiles(files);
    },
    [enabled, onFiles]
  );

  return { isDragging, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
};

/** Ficheiros colados (Ctrl+V de uma captura de ecrã ou de ficheiros copiados). */
export const filesFromPaste = (event: React.ClipboardEvent) =>
  Array.from(event.clipboardData?.files ?? []);
