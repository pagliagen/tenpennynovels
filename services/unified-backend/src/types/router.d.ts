/**
 * `router` (pacchetto usato internamente da Express 5) non pubblica tipi
 * propri e non esiste un `@types/router`. Dichiarato come `unknown` invece
 * di `any`: dump-routes.ts deve comunque passare per un cast esplicito
 * verso la forma che legge davvero (vedi RouterInstance in quel file),
 * lo stesso vincolo che avrebbe con qualunque altro valore `unknown`.
 */
declare module 'router' {
  const RouterFactory: unknown;
  export default RouterFactory;
}
