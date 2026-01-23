# /shared-new-type

Genera un nuovo tipo TypeScript condiviso in `services/shared/types/`.

## Uso

```
/shared-new-type [TypeName] [Description]
```

## Esempi

```
/shared-new-type Item "Game items interface"
/shared-new-type Notification "User notification interface"
/shared-new-type ApiRequest "API request wrapper"
```

## Cosa fa

Quando viene chiamato `/shared-new-type [TypeName] [Description]`:

1. **Crea tipo** in `services/shared/types/[typename].ts`
   - Definisce interface/type TypeScript
   - Include commenti JSDoc
   - Può includere enum, union types, etc.

2. **Pattern da seguire:**
   ```typescript
   /**
    * [TypeName] - [Description]
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

3. **Aggiungi export** in `services/shared/types/index.ts`
   ```typescript
   export * from './[typename]';
   ```

4. **Template da usare:**
   - `services/shared/types/character.ts` - Interface complessa
   - `services/shared/types/api.ts` - Tipi API
   - `services/shared/types/location.ts` - Tipi con enum

## Quando Creare Tipi Condivisi

Crea tipi condivisi quando:
- Il tipo è usato da più servizi backend
- Il tipo è usato da frontend e backend
- Il tipo rappresenta un'entità di dominio principale
- Il tipo è parte di un contratto API pubblico

## Checklist

Dopo la generazione, verifica:
- [ ] Tipo definito con commenti JSDoc
- [ ] Export aggiunto in `types/index.ts`
- [ ] Tipo può essere importato da altri moduli
- [ ] Naming convention seguita (PascalCase per interface, camelCase per file)

## Note importanti

- **Type Safety**: Usa sempre TypeScript strict
- **Documentation**: Aggiungi sempre commenti JSDoc
- **Naming**: File in camelCase, interface in PascalCase
- **Exports**: Aggiungi sempre export in `index.ts` per facilitare import

