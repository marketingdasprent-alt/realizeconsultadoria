import { describe, expect, it } from 'vitest';
import { installStepsFor } from '../install-steps';

describe('installStepsFor', () => {
  it('names the app and adapts to the browser', () => {
    const android = installStepsFor('android', 'Realize Admin', 'chrome');
    expect(android.steps[0]).toContain('menu ⋮');
    expect(android.steps.at(-1)).toContain('Realize Admin');
    expect(installStepsFor('android', 'Realize', 'firefox').steps[0]).toContain('Chrome');
  });

  it('covers iPhone, Windows and Mac', () => {
    expect(installStepsFor('ios', 'Realize', 'safari').steps.join(' ')).toContain(
      'Adicionar ao ecrã principal'
    );
    const windows = installStepsFor('windows', 'Realize', 'firefox');
    expect(windows.steps.join(' ')).toContain('Edge');
    expect(windows.note).toContain('Firefox');
    expect(installStepsFor('mac', 'Realize', 'safari').steps.join(' ')).toContain('Dock');
  });
});
