/**
 * Contratti dei punti di estensione.
 *
 * Vuoti in questa fase (Fase 1 dello scaffolding: vedi
 * docs/refactor/FEATURE-MODULES-PLAN.md). Una voce si aggiunge qui SOLO
 * nel momento in cui una fase successiva introduce un extension point
 * reale — es. Fase 2: 'documents.search.stream', Fase 3:
 * 'chat.message.persisted' — leggendo il payload dal codice che lo
 * emette davvero, mai indovinandolo in anticipo.
 *
 * Interfacce vuote (non index signature): `keyof HookMap` è `never`
 * finché non c'è almeno una voce, quindi registerHook()/emit() non
 * possono accettare nessuna chiave inventata. Un'index signature
 * (`[point: string]: ...`) romperebbe questa garanzia rendendo
 * `keyof` uguale a `string` — qualunque stringa passerebbe.
 */

/** Extension point di sola notifica: nessun valore di ritorno, un errore in un handler non blocca il core. */
export interface HookMap {
}

/**
 * Extension point di trasformazione: riceve un valore, ne restituisce uno,
 * eseguiti in sequenza per priorità. Ogni voce futura avrà la forma
 * `{ value: TValore; ctx: TContesto }`.
 */
export interface FilterMap {
}
