import { buildColorGrid, THEME_COLORS, loadRecentColors, rememberColor } from './colorGrid';

describe('buildColorGrid', () => {
  const grid = buildColorGrid();

  it('è una griglia 7 × 10 di esadecimali validi', () => {
    expect(grid).toHaveLength(7);
    for (const row of grid) {
      expect(row).toHaveLength(10);
      for (const color of row) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('la prima riga va dal nero al bianco', () => {
    expect(grid[0]?.[0]).toBe('#000000');
    expect(grid[0]?.[9]).toBe('#ffffff');
  });

  it('la riga delle tinte piene parte dal rosso (hue 0) con valori noti', () => {
    expect(grid[1]?.[1]).toBe('#ff0000');
    expect(grid[1]?.[4]).toBe('#00ff00');
    expect(grid[1]?.[6]).toBe('#006aff'); // hsl(215,100%,50%)
  });

  it('nessun colore ripetuto fra le righe a colori', () => {
    const colors = grid.slice(1).flat();
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('i colori del tema sono esadecimali validi', () => {
    for (const c of THEME_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('colori recenti', () => {
  beforeEach(() => window.localStorage.clear());

  it('il più recente va in cima e non ci sono doppioni', () => {
    rememberColor('#112233');
    rememberColor('#445566');
    expect(rememberColor('#112233')).toEqual(['#112233', '#445566']);
    expect(loadRecentColors()).toEqual(['#112233', '#445566']);
  });

  it('ignora valori non validi salvati a mano', () => {
    window.localStorage.setItem('documentEditor.recentColors', JSON.stringify(['#112233', 'rosso', 42]));
    expect(loadRecentColors()).toEqual(['#112233']);
  });

  it('non si rompe con JSON corrotto', () => {
    window.localStorage.setItem('documentEditor.recentColors', '{non json');
    expect(loadRecentColors()).toEqual([]);
  });
});
