// Barrel pubblico della feature. Vuoto: nessun consumer esterno reale trovato
// verso forum (i due punti di coupling noti — recalculateTopicLastPost/
// recalculateDiscussionLastPost usati dai controller admin, stripToPlainText
// usato dal model ForumPost — sono entrambi interni alla feature stessa dopo
// lo spostamento). Il canale Redis 'forum:events' non è un import: è un
// contratto pub/sub consumato da modules/game/events/handlers/
// ForumEventHandler.ts, fuori da questa feature per design (vedi manifest.ts).
