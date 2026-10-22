import React, { useLayoutEffect, useRef } from 'react';

type AutoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string };

/** Caixa de texto que cresce com o que se escreve (quem rola é o corpo do email, não ela). */
export const AutoTextarea: React.FC<AutoTextareaProps> = ({ value, className, ...props }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none ${className ?? ''}`}
      {...props}
    />
  );
};
