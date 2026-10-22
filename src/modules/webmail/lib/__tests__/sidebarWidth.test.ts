import { beforeEach, describe, expect, it } from 'vitest';
import {
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  clampSidebarWidth,
  readSidebarWidth,
  saveSidebarWidth,
} from '../sidebarWidth';

describe('sidebarWidth', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the width between the limits', () => {
    expect(clampSidebarWidth(50)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX);
    expect(clampSidebarWidth(301.6)).toBe(302);
  });

  it('remembers the chosen width, and ignores junk', () => {
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT);
    saveSidebarWidth(320);
    expect(readSidebarWidth()).toBe(320);
    localStorage.setItem('rz.mail.sidebar-width', 'abc');
    expect(readSidebarWidth()).toBe(SIDEBAR_DEFAULT);
  });
});
