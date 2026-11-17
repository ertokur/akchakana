import { act, render, screen } from '@testing-library/react';
import { App } from './App';
import { adjacentTab, swipeBlock, swipeDirection } from './useTabSwipe';
import userEvent from '@testing-library/user-event';
import { seedBasic, setupTestRepos } from '../../tests/helpers';

describe('свайпы между вкладками: логика', () => {
  it('соседние вкладки в порядке нижней навигации', () => {
    expect(adjacentTab('accounts', 'left')).toBe('home');
    expect(adjacentTab('debts', 'left')).toBe('home');
    expect(adjacentTab('home', 'left')).toBe('transactions');
    expect(adjacentTab('transactions', 'left')).toBe('stats');
    expect(adjacentTab('stats', 'left')).toBe('more');
    expect(adjacentTab('more', 'left')).toBeNull();
    expect(adjacentTab('more', 'right')).toBe('stats');
    expect(adjacentTab('home', 'right')).toBe('accounts');
    expect(adjacentTab('accounts', 'right')).toBeNull();
    // Вложенные экраны «Ещё» — не вкладки.
    expect(adjacentTab('settings', 'left')).toBeNull();
    expect(adjacentTab('import', 'right')).toBeNull();
  });

  it('горизонтальный жест — длинный или быстрый; вертикальный и медленный — нет', () => {
    const width = 390;
    expect(swipeDirection({ dx: -130, dy: 10, dt: 300, width })).toBe('left');
    expect(swipeDirection({ dx: 130, dy: -10, dt: 300, width })).toBe('right');
    expect(swipeDirection({ dx: -60, dy: 5, dt: 100, width })).toBe('left'); // быстрый
    expect(swipeDirection({ dx: -60, dy: 5, dt: 400, width })).toBeNull(); // короткий и медленный
    expect(swipeDirection({ dx: -130, dy: 90, dt: 300, width })).toBeNull(); // диагональ
    expect(swipeDirection({ dx: 10, dy: 300, dt: 300, width })).toBeNull(); // прокрутка
    expect(swipeDirection({ dx: -200, dy: 0, dt: 1200, width })).toBeNull(); // долгое касание
  });

  it('элементы со своим жестом блокируют свайп вкладок', () => {
    document.body.innerHTML = `
      <ul><li data-swipe-ignore="left"><span id="row">Операция</span></li></ul>
      <input id="field" />
      <div role="dialog"><button id="in-sheet">Ок</button></div>
      <div id="strip" style="overflow-x: auto"><span id="bubble">Зарплата</span></div>
      <p id="free">Текст</p>`;
    const strip = document.getElementById('strip')!;
    Object.defineProperty(strip, 'scrollWidth', { value: 600 });
    Object.defineProperty(strip, 'clientWidth', { value: 300 });
    const el = (id: string) => document.getElementById(id);
    expect(swipeBlock(el('row'))).toBe('left');
    expect(swipeBlock(el('field'))).toBe('all');
    expect(swipeBlock(el('in-sheet'))).toBe('all');
    expect(swipeBlock(el('bubble'))).toBe('all');
    expect(swipeBlock(el('free'))).toBeNull();
    document.body.innerHTML = '';
  });
});

function touch(type: 'touchstart' | 'touchend', target: Element, x: number, y = 300) {
  const point = { clientX: x, clientY: y, identifier: 1, target };
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    touches: { value: type === 'touchstart' ? [point] : [] },
    changedTouches: { value: [point] },
  });
  act(() => {
    target.dispatchEvent(event);
  });
}

function swipe(target: Element, dx: number) {
  touch('touchstart', target, 200);
  touch('touchend', target, 200 + dx);
}

describe('свайпы между вкладками в приложении', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('листает вкладки и не срабатывает при открытой шторке', async () => {
    const { repos } = await setupTestRepos();
    await seedBasic(repos);
    window.location.hash = '#/transactions';
    render(<App />);
    await screen.findByRole('heading', { name: 'Операции' });
    const main = document.querySelector('main')!;

    swipe(main, -150);
    expect(window.location.hash).toBe('#/stats');
    await screen.findByRole('heading', { name: 'Обзор' });

    swipe(document.querySelector('main')!, 150);
    expect(window.location.hash).toBe('#/transactions');
    await screen.findByRole('heading', { name: 'Операции' });

    // Открыт ввод операции — свайп принадлежит шторке.
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Добавить операцию' })[0]);
    await screen.findByRole('dialog', { name: 'Новая операция' });
    swipe(document.querySelector('main')!, -150);
    expect(window.location.hash).toBe('#/transactions');
  });
});
