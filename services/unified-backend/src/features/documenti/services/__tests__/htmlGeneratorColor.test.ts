import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateHtml } from '../HtmlGenerator';

const doc = (marks: unknown[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ciao', marks }] }]
});

describe('HtmlGenerator: colore del testo ed evidenziatore', () => {
  it('colore del testo in esadecimale → span con style', () => {
    const html = generateHtml(doc([{ type: 'textStyle', attrs: { color: '#8b1a1a' } }]));
    assert.match(html, /<span style="color: #8b1a1a">ciao<\/span>/);
  });

  it('evidenziatore → mark con background-color', () => {
    const html = generateHtml(doc([{ type: 'highlight', attrs: { color: '#fff2cc' } }]));
    assert.match(html, /<mark style="background-color: #fff2cc">ciao<\/mark>/);
  });

  it('accetta rgb() e rgba()', () => {
    for (const color of ['rgb(139, 26, 26)', 'rgba(0,0,0,0.5)']) {
      const html = generateHtml(doc([{ type: 'textStyle', attrs: { color } }]));
      assert.ok(html.includes(`style="color: ${color}"`), color);
    }
  });

  it('scarta valori che aggiungerebbero altre dichiarazioni o non sono colori', () => {
    for (const color of ['red; background: url(x)', '#fff;position:fixed', 'expression(alert(1))', 'var(--x)', '#12', 42]) {
      const text = generateHtml(doc([{ type: 'textStyle', attrs: { color } }]));
      assert.doesNotMatch(text, /style=/, `color=${String(color)}`);
      const mark = generateHtml(doc([{ type: 'highlight', attrs: { color } }]));
      assert.match(mark, /<mark>ciao<\/mark>/, `highlight=${String(color)}`);
    }
  });
});
