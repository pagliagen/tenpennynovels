import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import DOMPurify from 'isomorphic-dompurify';

import { filterColorStyle, sanitizeDocumentHtml } from '../sanitizeDocumentHtml';

void describe('sanitizeDocumentHtml: colori', () => {
  void it('conserva il colore del testo e l\'evidenziatore', () => {
    const html = sanitizeDocumentHtml(
      '<p><span class="fs-xl" style="color: #8b1a1a">a</span><mark style="background-color: #fff2cc">b</mark></p>'
    );
    assert.match(html, /<span class="fs-xl" style="color: #8b1a1a">a<\/span>/);
    assert.match(html, /<mark style="background-color: #fff2cc">b<\/mark>/);
  });

  void it('tiene solo le dichiarazioni di colore', () => {
    assert.equal(filterColorStyle('color: #abc; position: fixed; background-color: rgb(1, 2, 3)'), 'color: #abc; background-color: rgb(1, 2, 3)');
    assert.equal(filterColorStyle('COLOR:#ABCDEF'), 'color: #ABCDEF');
  });

  void it('toglie lo style quando non resta nessun colore valido', () => {
    for (const style of [
      'position: fixed; top: 0',
      'background: url(https://example.com/x.png)',
      'color: expression(alert(1))',
      'color: var(--x)',
      'background-color: url(x)',
      'font-size: 40px'
    ]) {
      const html = sanitizeDocumentHtml(`<span style="${style}">x</span>`);
      assert.equal(html, '<span>x</span>', style);
    }
  });

  void it('non lascia l\'hook registrato sull\'istanza condivisa', () => {
    sanitizeDocumentHtml('<span style="color: #000">x</span>');
    const html = DOMPurify.sanitize('<span style="position: fixed">x</span>', { ALLOWED_ATTR: ['style'] });
    assert.match(html, /position: fixed/);
  });

  void it('continua a togliere script e handler', () => {
    const html = sanitizeDocumentHtml('<p onclick="alert(1)">a<script>alert(1)</script><img src="x" onerror="alert(1)"></p>');
    assert.doesNotMatch(html, /onclick|onerror|script/);
  });
});
