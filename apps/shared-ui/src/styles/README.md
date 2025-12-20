# TenpennyNovels Design System

Sistema di design centralizzato per mantenere coerenza visiva tra tutte le applicazioni di TenpennyNovels.

## 🏗️ Struttura

```
apps/styles/
├── main.scss                 # Import principale - include tutto
├── index.scss               # Documentazione
├── variables/               # Token di design
│   ├── colors.scss         # Palette colori vittoriana
│   ├── typography.scss     # Font, dimensioni, spaziature
│   ├── spacing.scss        # Sistema di spaziature
│   ├── breakpoints.scss    # Media queries responsive
│   ├── shadows.scss        # Ombre e effetti blur
│   └── borders.scss        # Raggi e bordi
├── mixins/                  # Funzioni SCSS riusabili
│   ├── buttons.scss        # Stili bottoni vittoriani
│   ├── forms.scss          # Input e form fields
│   ├── cards.scss          # Card e frame vittoriani
│   └── animations.scss     # Animazioni comuni
├── components/              # Componenti base
│   ├── buttons.scss        # Classi bottoni ready-to-use
│   ├── forms.scss          # Classi form ready-to-use
│   ├── messages.scss       # Messaggi errore/successo
│   └── navigation.scss     # Navigazione comune
└── themes/                  # Varianti tematiche
    ├── victorian.scss      # Tema principale gioco
    └── admin.scss          # Tema pannelli admin
```

## 🎨 Palette Colori

### Colori Principali (Tema Vittoriano)
- **Gold Primary**: `#ff9500` - Accento principale oro
- **Gold Accent**: `#ffb847` - Oro chiaro per hover
- **Background**: `#1a1a1a` - Sfondo scuro principale

### Colori Funzionali
- **Success**: Verde scuro con accenti luminosi
- **Error**: Rosso scuro con accenti luminosi  
- **Warning**: Ambra scuro con accenti luminosi
- **Info**: Blu scuro con accenti luminosi

## 📝 Utilizzo

### Import Completo
```scss
@import '../../styles/main';
```

### Import Selettivo
```scss
@import '../../styles/variables/colors';
@import '../../styles/mixins/buttons';
```

### Mixins Principali

#### Bottoni Vittoriani
```scss
.my-button {
  @include victorian-button('primary', 'lg');
}
```

#### Input Forms
```scss
.my-input {
  @include victorian-input('md');
}
```

#### Card Vittoriane
```scss
.my-card {
  @include victorian-card('lg');
}
```

## 🔧 Classi Utility

### Messaggi
- `.message-error` - Messaggi di errore
- `.message-success` - Messaggi di successo  
- `.message-warning` - Avvisi
- `.message-info` - Informazioni

### Bottoni
- `.btn-victorian-primary` - Bottone principale oro
- `.btn-victorian-secondary` - Bottone outline oro
- `.btn-victorian-ghost` - Bottone trasparente

## 📱 Responsive

Sistema di breakpoint standardizzato:
- **Mobile**: `< 640px`
- **Tablet**: `640px - 1024px` 
- **Desktop**: `1024px+`

Utilizzo con mixins:
```scss
.my-component {
  @include mobile-only {
    padding: $spacing-sm;
  }
  
  @include desktop-up {
    padding: $spacing-lg;
  }
}
```

## 🎯 Vantaggi

✅ **Consistenza**: Colori e stili identici su tutte le app
✅ **Manutenibilità**: Modifiche centralizzate  
✅ **Scalabilità**: Facile aggiungere nuove app
✅ **Performance**: Import selettivi per bundle ridotti
✅ **DX**: Mixins pronti per sviluppo rapido

## 🔄 Migrazione

Per migrare un'app esistente:

1. Sostituire import shared-ui con design system:
   ```scss
   // Prima
   @import '@tenpennynovels/shared-ui/src/styles/variables';
   
   // Dopo  
   @import '../../styles/main';
   ```

2. Utilizzare variabili centralizzate:
   ```scss
   // Prima
   background: rgba(255, 255, 255, 0.95);
   
   // Dopo
   background: $input-bg;
   ```

3. Applicare mixins standardizzati:
   ```scss
   // Prima - stili custom
   .button { /* stili custom */ }
   
   // Dopo - mixin centralizzato
   .button {
     @include victorian-button('primary');
   }
   ```