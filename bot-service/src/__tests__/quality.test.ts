import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findIssues, issueFeedback } from '../quality';

// Battute reali del barista, dalla chat di test.
const first = "*Alzo lo sguardo dal registro sporco con un cenno della testa verso l'interno.* Il banco è libero per te, amico mio; vieni qua che non fa freddo dentro e c'è ancora posto a sedere prima che la botte si svuoti.";
const second = "*Prendo una tazzina calda dalla stufa e te ne pongo un'altra accanto al bicchiere.* Un tè nero con lo zucchero o qualcosa d'altro per scaldare le ossa? Siediti pure prima che la botte si svuoti.";

test('rileva la frase ripetuta dalle battute precedenti', () => {
  const issues = findIssues(second, [first]);
  const repeat = issues.find((i) => i.type === 'repeat');
  assert.ok(repeat && repeat.type === 'repeat');
  assert.ok(repeat.phrases.some((p) => p.includes('botte si svuoti')));
});

test('rileva le azioni in prima persona', () => {
  assert.deepEqual(findIssues(first, []).filter((i) => i.type === 'person').map((i) => i.type), ['person']);
  assert.ok(findIssues(second, []).some((i) => i.type === 'person'));
});

test('una battuta nuova in terza persona è pulita', () => {
  const ok = '*Posa un boccale di peltro davanti a lui e si china sul bancone.* Gin o birra? Due penny il gin, tre la birra scura.';
  assert.deepEqual(findIssues(ok, [first, second]), []);
});

test('rileva la stessa apertura', () => {
  const issues = findIssues('*Alza lo sguardo dal bancone.* Dica pure.', ['*Alza lo sguardo dal registro.* Prego.']);
  assert.ok(issues.some((i) => i.type === 'opener'));
});

test('grammatica comune e avverbi non sono falsi positivi', () => {
  assert.deepEqual(findIssues('*Dietro il bancone sistema le bottiglie.* Non è che non si possa.', ['Non è che non si faccia così, e dietro di lui il silenzio.']), []);
});

test('il feedback nomina le espressioni da evitare e la terza persona', () => {
  const text = issueFeedback(findIssues(second, [first]));
  assert.match(text, /botte si svuoti/);
  assert.match(text, /TERZA persona/);
});

test('rileva un personaggio con titolo che nessuno ha nominato', () => {
  const known = 'Sei Barnaby Finch, barista. testuser: Siete qui da molto?';
  const issues = findIssues('Chiedi a Mrs. Halloway dietro il banco, lei sa tutto.', [], known);
  assert.deepEqual(issues.filter((i) => i.type === 'invented'), [{ type: 'invented', names: ['Halloway'] }]);
  assert.match(issueFeedback(issues), /Halloway/);
});

test('un nome con titolo già presente nella chat non è inventato', () => {
  const known = 'Mrs. Hargreave è la locandiera';
  assert.deepEqual(findIssues('Chiedete a Mrs. Hargreave.', [], known), []);
});

test('il meteo che nessuno ha nominato è inventato; se è in chat o nella persona no', () => {
  const issues = findIssues('*Guarda fuori.* Mi piace il rumore della pioggia sulla strada.', [], 'Buonasera, è aperto?');
  assert.deepEqual(issues, [{ type: 'invented', names: ['pioggia'] }]);
  assert.deepEqual(findIssues('La pioggia non smette.', [], 'Che pioggia stasera!'), []);
});

test('un nome proprio a metà frase che nessuno ha nominato è inventato; inizio frase e allowlist no', () => {
  const known = 'Barnaby Finch, barista di Whitechapel. Annie è qui.';
  assert.deepEqual(
    findIssues('Prova alla locanda Blue Boar, vicino al molo di Cutler.', [], known),
    [{ type: 'invented', names: ['Blue', 'Boar', 'Cutler'] }],
  );
  assert.deepEqual(findIssues('Whitechapel è a due passi. *Guarda Annie.* Signore, Londra non dorme.', [], known), []);
  assert.deepEqual(findIssues('Entra pure. Vieni da Londra?', [], known), []);
});
