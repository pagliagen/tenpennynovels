# /frontend-new-component

Genera un nuovo componente React TypeScript per una delle app frontend.

## Uso

```
/frontend-new-component [ComponentName] [AppName] [Type]
```

## Esempi

```
/frontend-new-component ItemList game component
/frontend-new-component NotificationPanel game panel
/frontend-new-component UserForm management form
```

## Tipi di Componenti

- **component**: Componente standard riutilizzabile
- **panel**: Pannello laterale o modale
- **form**: Form con gestione stato
- **page**: Pagina completa (va in `pages/`)

## Cosa fa

Quando viene chiamato `/frontend-new-component [ComponentName] [AppName] [Type]`:

1. **Crea componente** in `apps/[AppName]/src/components/[ComponentName]/[ComponentName].tsx`
   - Componente funzionale React con TypeScript
   - Props interface definita
   - Hooks per gestione stato se necessario
   - Importa design system da `@tenpennynovels/shared-ui`

2. **Crea SCSS module** in `apps/[AppName]/src/components/[ComponentName]/[ComponentName].module.scss`
   - Importa design system: `@import '../../styles/main';` o `@import '@tenpennynovels/shared-ui/src/styles/main';`
   - Usa variabili condivise da design system
   - Segue pattern esistenti

3. **Pattern da seguire:**
   ```typescript
   import React, { useState, useEffect } from 'react';
   import styles from './[ComponentName].module.scss';

   interface [ComponentName]Props {
     // Props interface
   }

   export default function [ComponentName]({ ...props }: [ComponentName]Props) {
     // Hooks
     const [state, setState] = useState();

     // Effects
     useEffect(() => {
       // Side effects
     }, []);

     // Render
     return (
       <div className={styles.[componentName]}>
         {/* Component content */}
       </div>
     );
   }
   ```

4. **Template da usare:**
   - Game App: `apps/game/src/components/CharacterSheet.tsx`
   - Management App: `apps/management/src/pages/characters/character-list.tsx`
   - Design System: `apps/shared-ui/src/styles/README.md`

## Checklist

Dopo la generazione, verifica:
- [ ] Componente funzionale con TypeScript
- [ ] Props interface definita
- [ ] SCSS module creato e importato
- [ ] Design system importato nel SCSS
- [ ] Pattern esistenti seguiti
- [ ] Export default presente

## Note importanti

- **Design System**: Usa sempre variabili e mixins dal design system condiviso
- **Type Safety**: Definisci sempre interfacce TypeScript per props
- **Styling**: Usa sempre SCSS modules, non CSS globale
- **Consistency**: Segui pattern esistenti nel codebase

