/**
 * Riga ticket admin (lista /admin/tickets).
 * Campi aggiuntivi dipendono dalla configurazione tabella JSON.
 */
export interface AdminTicketRow {
  id: string;
  [key: string]: unknown;
}
