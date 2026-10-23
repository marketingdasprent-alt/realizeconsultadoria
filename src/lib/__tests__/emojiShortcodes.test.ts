import { describe, expect, it } from 'vitest';
import { emojiQueryAt, insertEmoji, searchEmojis } from '../emojiShortcodes';

describe('emojis por nome (como no WhatsApp)', () => {
  it('finds ":so" right before the caret, at the start or after a space', () => {
    expect(emojiQueryAt(':so', 3)).toEqual({ start: 0, query: 'so' });
    expect(emojiQueryAt('olá :sor', 8)).toEqual({ start: 4, query: 'sor' });
    expect(emojiQueryAt('olá :s', 6)).toBeNull(); // pelo menos 2 letras
    expect(emojiQueryAt('hora 10:30', 10)).toBeNull(); // horas não abrem a lista
    expect(emojiQueryAt('email:so', 8)).toBeNull(); // colado a uma palavra
  });

  it('suggests by Portuguese name, ignoring accents', () => {
    const so = searchEmojis('so').map(r => r.emoji);
    expect(so).toContain('😀'); // sorriso
    expect(so).toContain('😴'); // sono
    expect(searchEmojis('coracao')[0].emoji).toBe('❤️');
    expect(searchEmojis('coração')[0].emoji).toBe('❤️');
    expect(searchEmojis('obrigado').map(r => r.emoji)).toContain('🙏');
    expect(searchEmojis('xyzxyz')).toEqual([]);
  });

  it('replaces the shortcode with the emoji and a space', () => {
    expect(insertEmoji('olá :sor tudo', 4, 8, '😀')).toEqual({ text: 'olá 😀  tudo', caret: 7 });
  });
});
