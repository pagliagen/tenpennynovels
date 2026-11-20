import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateHtml, IMAGE_ALIGN_CLASSES, imageWidth } from '../HtmlGenerator';

// L'editor del gestionale usa immagini inline: stanno dentro un paragrafo.
const docWithImage = (attrs: Record<string, unknown>) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: '/a.png', alt: 'mappa', ...attrs } }] }]
});

describe('HtmlGenerator: immagini', () => {
  it('senza dimensione né posizione → come prima', () => {
    assert.equal(generateHtml(docWithImage({})), '<p><img src="/a.png" alt="mappa"></p>');
  });

  it('larghezza ridimensionata → attributo width intero, mai height né style', () => {
    const html = generateHtml(docWithImage({ width: 320.6, height: 200 }));
    assert.match(html, /<img src="\/a.png" alt="mappa" width="321">/);
    assert.doesNotMatch(html, /height|style=/);
  });

  for (const [align, cls] of Object.entries(IMAGE_ALIGN_CLASSES)) {
    it(`posizione ${align} → class="${cls}"`, () => {
      assert.match(generateHtml(docWithImage({ align, width: 200 })), new RegExp(`width="200" class="${cls}">`));
    });
  }

  it('posizione sconosciuta o iniettata → nessuna classe', () => {
    for (const align of ['top', 'left" onerror="x', null, 42]) {
      assert.equal(generateHtml(docWithImage({ align })), '<p><img src="/a.png" alt="mappa"></p>', String(align));
    }
  });

  it('larghezze non valide → scartate', () => {
    for (const value of [0, -10, 99999, Number.NaN, '200px', '1" onerror="x', null, undefined, {}]) {
      assert.equal(imageWidth(value), null, String(value));
    }
    assert.equal(imageWidth('240'), 240);
  });

  it('immagine a livello di blocco: stesse regole', () => {
    const html = generateHtml({ type: 'doc', content: [{ type: 'image', attrs: { src: '/b.png', align: 'center', width: 500 } }] });
    assert.equal(html, '<img src="/b.png" alt="" width="500" class="img-center">');
  });
});
