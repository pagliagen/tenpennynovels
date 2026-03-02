# Shared Types

Questa directory contiene tutti i tipi TypeScript condivisi tra frontend e backend.

## Scopo

I tipi in questa directory sono:
- Usati da più servizi backend
- Usati da frontend e backend insieme
- Parte di contratti API pubblici
- Entità di dominio principali

## Struttura

Ogni file contiene:
- **Interfaces**: Definizioni di tipi TypeScript
- **Enums**: Enumeration types
- **Union Types**: Union types per valori limitati
- **Type Aliases**: Alias per tipi complessi

## Pattern

### Definizione Tipo
```typescript
/**
 * [TypeName] - [Descrizione]
 * 
 * [Ulteriori dettagli se necessario]
 */
export interface [TypeName] {
  /** Campo con descrizione */
  fieldName: string;
  
  /** Campo opzionale */
  optionalField?: number;
}

// Enum se necessario
export enum [TypeName]Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

// Union type se necessario
export type [TypeName]Type = 'type1' | 'type2' | 'type3';
```

## File Principali

### character.ts
- Interfacce per personaggi
- Stats Call of Cthulhu
- Skills vittoriane
- Background strutturato

### location.ts
- Interfacce per location
- Permessi location
- Settings location

### api.ts
- Formato risposta API standardizzato
- Pagination info
- Error details

### corporation.ts
- Interfacce per corporazioni
- Ruoli corporazione
- Finanziamenti

## Aggiungere Nuovo Tipo

1. Crea file `[typename].ts` in questa directory (camelCase)
2. Definisci interface/type con commenti JSDoc
3. Usa naming PascalCase per interface, camelCase per file
4. Aggiungi export in `index.ts`

## Note Importanti

- **Naming**: File in camelCase, interface in PascalCase
- **Documentation**: Aggiungi sempre commenti JSDoc
- **Exports**: Aggiungi sempre export in `index.ts` per facilitare import
- **Type Safety**: Usa sempre TypeScript strict mode
- **Consistency**: Mantieni coerenza con modelli database quando possibile

