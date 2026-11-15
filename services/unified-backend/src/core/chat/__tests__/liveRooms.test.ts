import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveRooms } from '../liveRooms';

test('nessun personaggio: nessuna room riservata', () => {
  assert.deepEqual(resolveLiveRooms(null), { chatMasters: false, staff: false, leadership: false });
});

test('master approvato: riceve sussurri e notifiche di servizio', () => {
  const rooms = resolveLiveRooms({ playerStatus: 'approved', gameplayRoles: ['master'] });
  assert.equal(rooms.chatMasters, true);
  assert.equal(rooms.staff, true);
  assert.equal(rooms.leadership, false);
});

test('master in bozza o in attesa: non riceve nulla', () => {
  for (const playerStatus of ['draft', 'pending']) {
    const rooms = resolveLiveRooms({ playerStatus, gameplayRoles: ['master'] });
    assert.deepEqual(rooms, { chatMasters: false, staff: false, leadership: false }, playerStatus);
  }
});

test('stato assente: trattato come bozza', () => {
  const rooms = resolveLiveRooms({ gameplayRoles: ['master'] });
  assert.equal(rooms.chatMasters, false);
  assert.equal(rooms.staff, false);
});

test('gestore in bozza: notifiche di servizio sì, sussurri no', () => {
  const rooms = resolveLiveRooms({ playerStatus: 'draft', isGestore: true, gameplayRoles: ['master'] });
  assert.equal(rooms.chatMasters, false);
  assert.equal(rooms.staff, true);
  assert.equal(rooms.leadership, true);
});

test('gestore approvato: tutto', () => {
  const rooms = resolveLiveRooms({ playerStatus: 'approved', isGestore: true });
  assert.deepEqual(rooms, { chatMasters: true, staff: true, leadership: true });
});

test('giocatore approvato: nessuna room riservata', () => {
  const rooms = resolveLiveRooms({ playerStatus: 'approved', gameplayRoles: ['player'] });
  assert.deepEqual(rooms, { chatMasters: false, staff: false, leadership: false });
});

test('negazione esplicita del permesso master: niente sussurri', () => {
  const rooms = resolveLiveRooms({
    playerStatus: 'approved',
    gameplayRoles: ['master'],
    characterPermissions: ['-game:chat:master-action'],
  });
  assert.equal(rooms.chatMasters, false);
});
