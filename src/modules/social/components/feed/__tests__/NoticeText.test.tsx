import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoticeText } from '../NoticeText';

describe('NoticeText (comunicado no Feed)', () => {
  it('negrito, itálico, listas e ligações, sem as marcas à vista', () => {
    const { container } = render(
      <NoticeText
        text={
          'Na **segunda-feira** muda _tudo_.\n\nPassos:\n- Abra https://realize.dasprent.pt\n- Envie a **mensagem**\n\n1. um\n2. dois'
        }
      />
    );
    expect(screen.getByText('segunda-feira').tagName).toBe('STRONG');
    expect(screen.getByText('tudo').tagName).toBe('EM');
    const [ul, ol] = [container.querySelector('ul')!, container.querySelector('ol')!];
    expect(within(ul).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(ol)
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual(['um', 'dois']);
    const link = screen.getByRole('link', { name: 'https://realize.dasprent.pt' });
    expect(link).toHaveAttribute('href', 'https://realize.dasprent.pt');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.textContent).not.toMatch(/\*\*|(^|\s)_\w|^- /m);
  });

  it('underscores em emails e URLs e HTML no texto ficam como texto', () => {
    const { container } = render(
      <NoticeText
        text={'Fale com joao_silva@useauto.pt <b>já</b> ou veja https://x.pt/guia_rapido.pdf'}
      />
    );
    expect(container.querySelector('em')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('joao_silva@useauto.pt <b>já</b>');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://x.pt/guia_rapido.pdf');
  });
});
