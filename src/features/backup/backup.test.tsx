import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/App';
import { parseOwnCsv } from '../../importers/ownCsv';
import { useData } from '../../stores/dataStore';
import { makeTx, seedBasic, setupTestRepos } from '../../../tests/helpers';
import { createSnapshot, runSnapshotIfDue } from './backup';

const DAY = 86_400_000;

describe('автосохранение', () => {
  afterEach(() => {
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('внутренняя копия по расписанию, ротация и формат собственного CSV', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    await repos.transactions.put(makeTx({ id: 't1', accountId: account.id }));
    await repos.settings.update({ autoBackupKeep: 3, autoBackupFrequency: 'daily' });
    await useData.getState().load();

    const start = Date.parse('2026-03-01T06:00:00Z');
    expect(await runSnapshotIfDue(start)).toBe(true);
    // В тот же день повторно не делается.
    expect(await runSnapshotIfDue(start + 3_600_000)).toBe(false);
    for (let d = 1; d <= 4; d++) expect(await runSnapshotIfDue(start + d * DAY)).toBe(true);

    const list = await repos.backups.list();
    expect(list.map((b) => b.createdAt)).toEqual([4, 3, 2].map((d) => start + d * DAY));
    expect(list[0].fileName).toBe('akchakana-backup-2026-03-05.csv');
    const plan = parseOwnCsv(list[0].content);
    expect(plan.transactions.map((t) => t.id)).toEqual(['t1']);
    expect((await repos.settings.get()).lastSnapshotAt).toBe(start + 4 * DAY);
  });

  it('без данных и при выключенном автосохранении копия не создаётся', async () => {
    const { repos } = await setupTestRepos();
    await useData.getState().load();
    expect(await createSnapshot()).toBeNull();
    await seedBasic(repos);
    await repos.settings.update({ autoBackupEnabled: false });
    await useData.getState().load();
    expect(await runSnapshotIfDue()).toBe(false);
    expect(await repos.backups.list()).toHaveLength(0);
  });

  it('настройки: частота, число копий и «Сохранить копию сейчас»', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    await repos.transactions.put(makeTx({ id: 't1', accountId: account.id }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    window.location.hash = '#/settings';
    const user = userEvent.setup();
    render(<App />);

    const section = within(await screen.findByRole('region', { name: /Резервные копии/ }));
    expect(section.getByRole('switch', { name: /Автосохранение/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(section.getByText('Файл копии ещё не сохранялся.')).toBeInTheDocument();
    // Планировщик при запуске сразу делает первую внутреннюю копию.
    await waitFor(async () => expect(await repos.backups.list()).toHaveLength(1));

    await user.click(section.getByRole('radio', { name: 'Ежемесячно' }));
    await user.selectOptions(section.getByLabelText('Хранить копий внутри приложения'), '10');
    await waitFor(async () => {
      const s = await repos.settings.get();
      expect(s.autoBackupFrequency).toBe('monthly');
      expect(s.autoBackupKeep).toBe(10);
    });

    // В jsdom нет меню «Поделиться» — файл скачивается.
    await user.click(section.getByRole('button', { name: /Сохранить копию сейчас/ }));
    expect(await screen.findByText('Копия сохранена в «Загрузки»')).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
    const s = await repos.settings.get();
    expect(s.lastAutoBackupAt).toBeDefined();
    expect(s.lastExportAt).toBe(s.lastAutoBackupAt);
    expect(await section.findByText(/Последний файл копии:/)).toBeInTheDocument();
    expect(section.getByText(/Следующее напоминание:/)).toBeInTheDocument();
    expect(
      await section.findByRole('list', { name: 'Копии внутри приложения' }),
    ).toBeInTheDocument();
    // Одна копия — от планировщика при запуске, вторая — вместе с сохранённым файлом.
    expect(await repos.backups.list()).toHaveLength(2);

    await user.click(section.getByRole('switch', { name: /Автосохранение/ }));
    await waitFor(async () => expect((await repos.settings.get()).autoBackupEnabled).toBe(false));
    expect(section.queryByRole('radio', { name: 'Ежемесячно' })).not.toBeInTheDocument();
  });

  it('баннер на главной, когда подошёл срок, и откладывание до завтра', async () => {
    const { repos } = await setupTestRepos();
    const { account } = await seedBasic(repos);
    await repos.accounts.put({ ...account, createdAt: Date.now() - 30 * DAY });
    const user = userEvent.setup();
    render(<App />);

    const banner = await screen.findByRole('region', { name: 'Резервная копия' });
    expect(within(banner).getByRole('button', { name: 'Сохранить копию' })).toBeInTheDocument();
    await user.click(within(banner).getByRole('button', { name: 'Завтра' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Резервная копия' })).not.toBeInTheDocument(),
    );
    expect((await repos.settings.get()).autoBackupSnoozedUntil).toBeGreaterThan(Date.now());
  });
});
