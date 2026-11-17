import pkg from '../package.json';
import { CHANGELOG } from './changelog';

describe('список изменений', () => {
  it('верхняя запись соответствует версии приложения в package.json', () => {
    expect(CHANGELOG[0].version).toBe(pkg.version);
  });

  it('версии уникальны, идут по убыванию, у каждой есть дата и пункты на обоих языках', () => {
    const versions = CHANGELOG.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    const num = (v: string) => v.split('.').map(Number);
    for (let i = 1; i < CHANGELOG.length; i++) {
      const [a, b] = [num(CHANGELOG[i - 1].version), num(CHANGELOG[i].version)];
      const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      expect(cmp).toBeGreaterThan(0);
    }
    for (const e of CHANGELOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.changes.ru.length).toBeGreaterThan(0);
      expect(e.changes.en.length).toBe(e.changes.ru.length);
    }
  });
});
