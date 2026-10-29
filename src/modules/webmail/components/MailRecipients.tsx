import React, { useState } from 'react';
import { nameOf } from '../lib/mailFormat';
import type { MailAddress } from '../types';

interface MailRecipientsProps {
  to: MailAddress[];
  cc: MailAddress[];
  /** Carregar numa pessoa: email novo para ela. */
  onWrite?: (address: MailAddress) => void;
}

const VISIBLE = 4;

/** Uma pessoa do cabeçalho: o nome, com o endereço ao passar; carregar escreve-lhe. */
export const AddressChip: React.FC<{
  address: MailAddress;
  onWrite?: (address: MailAddress) => void;
  className?: string;
}> = ({ address, onWrite, className = '' }) =>
  onWrite ? (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation();
        onWrite(address);
      }}
      title={`${address.email} · escrever email novo`}
      className={`rounded-md px-0.5 text-rz-ink hover:bg-rz-primary-soft hover:text-rz-primary hover:underline ${className}`}
    >
      {nameOf(address)}
    </button>
  ) : (
    <span title={address.email} className={className}>
      {nameOf(address)}
    </span>
  );

/** "Para" e "Cc" com todas as pessoas (as que não cabem abrem em "+N"), cada uma clicável. */
export const MailRecipients: React.FC<MailRecipientsProps> = ({ to, cc, onWrite }) => {
  const [expanded, setExpanded] = useState(false);
  const total = to.length + cc.length;
  let budget = expanded ? Infinity : VISIBLE;

  const line = (label: string, list: MailAddress[]) => {
    if (!list.length || budget <= 0) return null;
    const shown = list.slice(0, budget);
    budget -= shown.length;
    return (
      <span className="mr-2">
        <span className="text-rz-muted">{label} </span>
        {shown.map((address, index) => (
          <React.Fragment key={`${address.email}-${index}`}>
            <AddressChip address={address} onWrite={onWrite} />
            {index < shown.length - 1 && <span className="text-rz-muted">, </span>}
          </React.Fragment>
        ))}
      </span>
    );
  };

  if (!total) return <p className="text-rz-muted">Para —</p>;
  return (
    <p className="leading-relaxed">
      {line('Para', to)}
      {line('Cc', cc)}
      {total > VISIBLE && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            setExpanded(value => !value);
          }}
          className="rounded-full bg-rz-canvas px-2 py-0.5 text-[12px] font-semibold text-rz-muted hover:text-rz-primary"
        >
          {expanded ? 'Mostrar menos' : `+${total - VISIBLE}`}
        </button>
      )}
    </p>
  );
};
