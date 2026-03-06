#!/usr/bin/env tsx

import { ObjectId } from 'mongodb';
import { getConnection } from '../utils/connection.js';
 
// Italian Forum seed data - Comprehensive Victorian London RPG content
const forumSeedData = {
  topics: [
    {
      slug: 'benvenuti-a-tenpennynovels',
      title: 'Benvenuti a TenPennyNovels',
      description: 'Discussioni generali sulla London Vittoriana e il nostro GDR',
      category: 'Generale',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: true,
      postCount: 8,
      color: '#8B4513',
      icon: '🎭',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'creazione-personaggi',
      title: 'Creazione Personaggi',
      description: 'Condividi le tue storie, background e lo sviluppo dei personaggi',
      category: 'Gioco di Ruolo',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 15,
      color: '#4B0082',
      icon: '👤',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'meccaniche-di-gioco',
      title: 'Meccaniche di Gioco',
      description: 'Discussioni su Call of Cthulhu, regole della casa e modifiche Vittoriane',
      category: 'Gioco di Ruolo',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 12,
      color: '#2E8B57',
      icon: '🎲',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'londra-vittoriana',
      title: 'Londra Vittoriana',
      description: 'Storia, cultura e ambientazione della London del 1890',
      category: 'Ambientazione',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 20,
      color: '#DAA520',
      icon: '🏰',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'investigazioni',
      title: 'Investigazioni e Misteri',
      description: 'Casi, indagini e misteri da risolvere nella nebbia londinese',
      category: 'Gioco di Ruolo',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 18,
      color: '#8B4513',
      icon: '🔍',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'occultismo-cthulhu',
      title: 'Occultismo e Miti di Cthulhu',
      description: 'Discussioni sui Grandi Antichi e l\'occulto nell\'era Vittoriana',
      category: 'Soprannaturale',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 22,
      color: '#800080',
      icon: '👁️',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'vita-quotidiana',
      title: 'Vita Quotidiana Vittoriana',
      description: 'Costumi, tradizioni e la vita di tutti i giorni nel 1890',
      category: 'Ambientazione',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 16,
      color: '#A0522D',
      icon: '☕',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'corporazioni-e-societa',
      title: 'Corporazioni e Società',
      description: 'Discussioni sulle corporazioni, gilde e società segrete',
      category: 'Ambientazione',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 14,
      color: '#B8860B',
      icon: '🏛️',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      slug: 'sessioni-private',
      title: 'Sessioni Private',
      description: 'Discussioni private per personaggi approvati',
      category: 'Gioco di Ruolo',
      isPublic: false,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 9,
      color: '#8B0000',
      icon: '🔒',
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    }
  ],
  discussions: [
    // Benvenuti discussions
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      slug: 'benvenuti-nuovi-giocatori',
      title: 'Benvenuti Nuovi Giocatori!',
      isPinned: true,
      isLocked: false,
      isVisible: true,
      postCount: 3,
      viewCount: 156,
      tags: ['benvenuto', 'nuovo-giocatore'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco',
        characterName: 'Il Narratore',
        characterId: 'narrator-char-id'
      }
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      slug: 'regole-del-forum',
      title: 'Regole del Forum e Linee Guida',
      isPinned: true,
      isLocked: true,
      isVisible: true,
      postCount: 1,
      viewCount: 203,
      tags: ['regole', 'linee-guida'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      slug: 'presentazioni',
      title: 'Presentatevi alla Comunità',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 4,
      viewCount: 89,
      tags: ['presentazione'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    // Creazione personaggi discussions
    {
      topicSlug: 'creazione-personaggi',
      slug: 'detective-vittoriano',
      title: 'Il Mio Detective Vittoriano - Ispettore Blackwood',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 5,
      viewCount: 67,
      tags: ['detective', 'background', 'polizia'],
      createdBy: {
        userId: 'player1',
        username: 'SignoraVittoriana',
        characterName: 'Lady Margaret Ashworth',
        characterId: 'lady-margaret-id'
      }
    },
    {
      topicSlug: 'creazione-personaggi',
      slug: 'consigli-creazione',
      title: 'Consigli per Creare Personaggi Vittoriani Autentici',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 7,
      viewCount: 112,
      tags: ['consigli', 'creazione', 'autenticità'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      topicSlug: 'creazione-personaggi',
      slug: 'medico-alienista',
      title: 'Dr. Edmund Hartwell - Medico Alienista di Bedlam',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 3,
      viewCount: 45,
      tags: ['medico', 'alienista', 'bedlam', 'psicologia'],
      createdBy: {
        userId: 'player2',
        username: 'DottorMisterioso',
        characterName: 'Dr. Edmund Hartwell',
        characterId: 'dr-hartwell-id'
      }
    },
    // Meccaniche di gioco discussions
    {
      topicSlug: 'meccaniche-di-gioco',
      slug: 'regole-della-casa',
      title: 'Le Nostre Regole della Casa per Londra Vittoriana',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 8,
      viewCount: 134,
      tags: ['regole-casa', 'meccaniche'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      topicSlug: 'meccaniche-di-gioco',
      slug: 'sistema-sanita-mentale',
      title: 'Sistema di Sanità Mentale Modificato',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 4,
      viewCount: 78,
      tags: ['sanità', 'follia', 'modifiche'],
      createdBy: {
        userId: 'player3',
        username: 'StudiosoDellaMente',
        characterName: 'Prof. Aldrich Pemberton',
        characterId: 'prof-pemberton-id'
      }
    },
    // Londra Vittoriana discussions
    {
      topicSlug: 'londra-vittoriana',
      slug: 'quartieri-londinesi',
      title: 'I Quartieri di Londra: Whitechapel, Mayfair e Oltre',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 9,
      viewCount: 187,
      tags: ['quartieri', 'geografia', 'whitechapel', 'mayfair'],
      createdBy: {
        userId: 'player4',
        username: 'EsploratoreUrbano',
        characterName: 'William Thornfield',
        characterId: 'william-thornfield-id'
      }
    },
    {
      topicSlug: 'londra-vittoriana',
      slug: 'sistema-sociale',
      title: 'Il Sistema Sociale e le Classi nell\'Era Vittoriana',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 6,
      viewCount: 145,
      tags: ['classi-sociali', 'aristocrazia', 'borghesia'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      topicSlug: 'londra-vittoriana',
      slug: 'tecnologia-1890',
      title: 'Tecnologia e Invenzioni del 1890',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 5,
      viewCount: 98,
      tags: ['tecnologia', 'invenzioni', '1890'],
      createdBy: {
        userId: 'player5',
        username: 'InventoreEccentrico',
        characterName: 'Sir Reginald Cogsworth',
        characterId: 'sir-cogsworth-id'
      }
    },
    // Investigazioni discussions
    {
      topicSlug: 'investigazioni',
      slug: 'caso-museum-britannico',
      title: 'Il Mistero del British Museum - Artefatti Scomparsi',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 7,
      viewCount: 123,
      tags: ['british-museum', 'artefatti', 'furto', 'egittologia'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco',
        characterName: 'Il Narratore',
        characterId: 'narrator-char-id'
      }
    },
    {
      topicSlug: 'investigazioni',
      slug: 'omicidi-east-end',
      title: 'Strani Omicidi nell\'East End - Non È Jack lo Squartatore',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 11,
      viewCount: 201,
      tags: ['omicidi', 'east-end', 'mistero', 'polizia'],
      createdBy: {
        userId: 'player6',
        username: 'IspettoreScotlandYard',
        characterName: 'Inspector Charles Whitmore',
        characterId: 'inspector-whitmore-id'
      }
    },
    // Occultismo discussions
    {
      topicSlug: 'occultismo-cthulhu',
      slug: 'societa-segrete',
      title: 'Società Segrete e Ordini Occultisti a Londra',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 8,
      viewCount: 167,
      tags: ['società-segrete', 'occultismo', 'ordini'],
      createdBy: {
        userId: 'player7',
        username: 'StudiosoDellOcculto',
        characterName: 'Madame Vivienne Blackthorne',
        characterId: 'madame-blackthorne-id'
      }
    },
    {
      topicSlug: 'occultismo-cthulhu',
      slug: 'tomi-maledetti',
      title: 'Tomi Maledetti e Libri Proibiti della Biblioteca di Miskatonic',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 6,
      viewCount: 134,
      tags: ['tomi', 'libri-proibiti', 'miskatonic', 'necronomicon'],
      createdBy: {
        userId: 'player8',
        username: 'BibliotecarioOscuro',
        characterName: 'Dr. Algernon Whitmarsh',
        characterId: 'dr-whitmarsh-id'
      }
    },
    // Vita quotidiana discussions
    {
      topicSlug: 'vita-quotidiana',
      slug: 'abbigliamento-vittoriano',
      title: 'Abbigliamento e Moda nell\'Era Vittoriana',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 5,
      viewCount: 89,
      tags: ['moda', 'abbigliamento', 'costume'],
      createdBy: {
        userId: 'player9',
        username: 'DamaDiSocietà',
        characterName: 'Lady Arabella Fairfax',
        characterId: 'lady-fairfax-id'
      }
    },
    {
      topicSlug: 'vita-quotidiana',
      slug: 'cucina-vittoriana',
      title: 'Cucina e Banchetti nell\'Alto Ceto Vittoriano',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 4,
      viewCount: 72,
      tags: ['cucina', 'banchetti', 'galateo'],
      createdBy: {
        userId: 'player10',
        username: 'ChefDellaCorte',
        characterName: 'Monsieur Auguste Dubois',
        characterId: 'chef-dubois-id'
      }
    },
    // Corporazioni discussions
    {
      topicSlug: 'corporazioni-e-societa',
      slug: 'collegio-medici',
      title: 'Il Royal College of Physicians - Ammissioni e Procedure',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 6,
      viewCount: 98,
      tags: ['collegio-medici', 'medicina', 'corporazione'],
      createdBy: {
        userId: 'system',
        username: 'MaestroDelGioco'
      }
    },
    {
      topicSlug: 'corporazioni-e-societa',
      slug: 'ordine-avvocati',
      title: 'L\'Ordine degli Avvocati di Lincoln\'s Inn',
      isPinned: false,
      isLocked: false,
      isVisible: true,
      postCount: 4,
      viewCount: 67,
      tags: ['avvocati', 'lincolns-inn', 'legge'],
      createdBy: {
        userId: 'player11',
        username: 'AvvocatoVittoriano',
        characterName: 'Barrister Jonathan Hartwell',
        characterId: 'barrister-hartwell-id'
      }
    }
  ],
  // Extensive Italian posts content
  posts: [
    // Benvenuti posts
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'benvenuti-nuovi-giocatori',
      content: 'Benvenuti a TenPennyNovels, la nostra comunità dedicata al GDR Call of Cthulhu ambientato nella Londra Vittoriana! Questo è un luogo dove potete immergervi nelle strade nebbiose della London del 1890, creare personaggi avvincenti e partecipare ad avventure misteriose.\n\nChe siate investigatori esperti o nuovi al mondo di Cthulhu, tutti sono benvenuti qui. Per favore, prendetevi del tempo per leggere le nostre regole e presentarvi alla comunità.',
      authorUserId: 'system',
      authorUsername: 'MaestroDelGioco',
      authorCharacterName: 'Il Narratore',
      authorCharacterId: 'narrator-char-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      slug: 'benvenuti-nuovi-giocatori',
      content: 'Ricordatevi di creare i vostri personaggi seguendo le linee guida dell\'epoca Vittoriana. La verosimiglianza storica è importante per mantenere l\'atmosfera immersiva del gioco!',
      authorUserId: 'player1',
      authorUsername: 'SignoraVittoriana',
      authorCharacterName: 'Lady Margaret Ashworth',
      authorCharacterId: 'lady-margaret-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'regole-del-forum',
      content: '# Regole del Forum e Linee Guida\n\n1. **Rispetto Reciproco**: Trattate tutti i membri della comunità con rispetto e cortesia.\n2. **Rimanete nel Personaggio**: Quando scrivete nei panni del vostro personaggio, mantenete l\'atmosfera Vittoriana.\n3. **Niente Spoiler**: Usate i tag spoiler quando discutete elementi della trama.\n4. **Accuratezza Storica**: Mantenete l\'accuratezza storica quando possibile.\n5. **Divertitevi**: Ricordate, siamo qui per divertirci e raccontare grandi storie insieme!\n\n## Regole Specifiche per il Roleplay\n- Rispettate le differenze di classe sociale dell\'epoca\n- I personaggi devono agire secondo i valori e le conoscenze del 1890\n- Le donne hanno limitazioni sociali dell\'epoca (ma possono essere creative nel superarle!)\n- La tecnologia è limitata a quella disponibile nel 1890',
      authorUserId: 'system',
      authorUsername: 'MaestroDelGioco',
      isEdited: false,
      isDeleted: false,
      isPinned: true
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'presentazioni',
      content: 'Vi prego di presentarvi alla comunità! Raccontateci qualcosa di voi, la vostra esperienza con i GDR, e cosa vi attira dei misteri della Londra Vittoriana.',
      authorUserId: 'system',
      authorUsername: 'MaestroDelGioco',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'presentazioni',
      content: 'Salve a tutti! Sono nuovo nel mondo di Call of Cthulhu ma sono affascinato dall\'atmosfera Vittoriana. Ho sempre amato i romanzi di Arthur Conan Doyle e sono entusiasta di creare il mio investigatore!',
      authorUserId: 'player12',
      authorUsername: 'NeofitoMisterioso',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // Detective character posts
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'detective-vittoriano',
      content: 'Ho creato l\'Ispettore Thomas Blackwood di Scotland Yard. È un detective di mezza età che ha visto troppo durante la sua carriera. Ha iniziato a notare connessioni inquietanti tra casi apparentemente non collegati, portandolo nel mondo dell\'occulto.\n\nLe sue specialità includono Investigare, Psicologia e Trovare Oggetti Nascosti. La sua esperienza nella polizia gli dà accesso a informazioni e luoghi che altri non possono raggiungere.',
      authorUserId: 'player1',
      authorUsername: 'SignoraVittoriana',
      authorCharacterName: 'Lady Margaret Ashworth',
      authorCharacterId: 'lady-margaret-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'detective-vittoriano',
      content: 'Ottimo concept! Ho pensato che potrebbe avere una connessione con il mio personaggio, Dr. Hartwell. Forse si sono incontrati durante un caso di omicidio dove la sanità mentale dell\'assassino era in questione?',
      authorUserId: 'player2',
      authorUsername: 'DottorMisterioso',
      authorCharacterName: 'Dr. Edmund Hartwell',
      authorCharacterId: 'dr-hartwell-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // Character creation tips
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'consigli-creazione',
      content: 'Ecco alcuni consigli per creare personaggi Vittoriani convincenti:\n\n## Ricerca Storica\n- Studiate il sistema delle classi sociali della London del 1890\n- Considerate come l\'occupazione del vostro personaggio influenzi la sua vita quotidiana\n- Pensate alle relazioni familiari e sociali\n- Non dimenticate gli elementi soprannaturali - come reagisce il vostro personaggio all\'ignoto?\n\n## Autenticità dell\'Epoca\n- La maggior parte delle persone di quest\'epoca erano molto religiose e superstiziose\n- Le donne avevano ruoli sociali limitati ma potevano essere creative\n- La medicina era primitiva rispetto agli standard moderni\n- La comunicazione era lenta - niente telefoni per la maggior parte delle persone!',
      authorUserId: 'system',
      authorUsername: 'MaestroDelGioco',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // Medical character background
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'medico-alienista',
      content: 'Presento il Dr. Edmund Hartwell, medico alienista presso il Bethlem Royal Hospital (Bedlam). È specializzato nel trattamento dei disturbi mentali e ha sviluppato teorie controverse sui collegamenti tra follia e esperienze soprannaturali.\n\nDopo aver curato diversi pazienti che raccontavano storie simili di "orrori cosmici", ha iniziato a sospettare che non tutti fossero semplicemente folli. Le sue competenze includono Medicina, Psicologia e Biblioteca - ha una vasta collezione di testi medici e psichiatrici.',
      authorUserId: 'player2',
      authorUsername: 'DottorMisterioso',
      authorCharacterName: 'Dr. Edmund Hartwell',
      authorCharacterId: 'dr-hartwell-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // Game mechanics discussions
    {
      topicSlug: 'meccaniche-di-gioco',
      discussionSlug: 'regole-della-casa',
      content: 'Le nostre regole della casa per l\'ambientazione Vittoriana:\n\n## Status Sociale\n1. **Le Classi Contano**: Personaggi di diverse classi sociali hanno accesso diverso a informazioni e luoghi.\n2. **Codici di Abbigliamento**: L\'abbigliamento appropriato è necessario per accedere a certi ambienti.\n3. **Genere e Società**: Le donne affrontano restrizioni sociali ma possono usare la creatività per superarle.\n\n## Recupero Sanità Mentale\n- **Attività Vittoriane**: Tè pomeridiano, lettura, musica classica\n- **Vacanze**: Viaggi in campagna o alle terme\n- **Religione**: La preghiera e la frequentazione della chiesa possono aiutare\n\n## Limitazioni Tecnologiche\n- Ricordate i vincoli tecnologici del 1890\n- Niente elettricità nella maggior parte delle case\n- Comunicazioni lente - lettere e telegrammi\n- Medicina primitiva',
      authorUserId: 'system',
      authorUsername: 'MaestroDelGioco',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // Victorian London geography
    {
      topicSlug: 'londra-vittoriana',
      discussionSlug: 'quartieri-londinesi',
      content: 'Una guida ai principali quartieri di Londra nell\'era Vittoriana:\n\n## **Mayfair** - Il Cuore dell\'Aristocrazia\nDove vivono i ricchi e potenti. Eleganti townhouse, club esclusivi, e la migliore società londinese.\n\n## **Whitechapel** - L\'East End Pericoloso\nUn labirinto di vicoli stretti, taverne fumose, e criminalità. Casa della classe operaia e dei più disperati.\n\n## **Westminster** - Il Centro del Potere\nParlamento, Whitehall, e gli uffici governativi. Il cuore politico dell\'Impero.\n\n## **Bloomsbury** - Gli Intellettuali\nUniversità, musei (incluso il British Museum), e la casa di scrittori e pensatori.\n\n## **La City** - Il Centro Finanziario\nBanche, compagnie assicurative, e il commercio dell\'Impero. Affollato di giorno, deserto di notte.',
      authorUserId: 'player4',
      authorUsername: 'EsploratoreUrbano',
      authorCharacterName: 'William Thornfield',
      characterId: 'william-thornfield-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // British Museum mystery
    {
      topicSlug: 'investigazioni',
      discussionSlug: 'caso-museum-britannico',
      content: 'È stato segnalato uno strano caso al British Museum. Diversi artefatti egiziani sono scomparsi dalle collezioni, ma non sembra un furto ordinario. I custodi notturni parlano di "sussurri" e "ombre che si muovono" nelle sale egizie dopo il tramonto.\n\nL\'investigazione ufficiale non ha portato a nulla, ma ci sono dettagli inquietanti:\n- I furti avvengono solo durante le notti di luna nuova\n- Gli artefatti rubati sono tutti legati alla morte e all\'aldilà\n- Un custode è stato trovato in stato catatonico, mormorando in una lingua sconosciuta\n\nChi è interessato a investigare questo mistero?',
      authorUserId: 'system',
      authorUsername: 'MaestroDelGioco',
      authorCharacterName: 'Il Narratore',
      characterId: 'narrator-char-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // Occult societies
    {
      topicSlug: 'occultismo-cthulhu',
      discussionSlug: 'societa-segrete',
      content: 'Le società segrete fioriscono nell\'ombra della Londra Vittoriana. Ecco alcune delle più note (e temute):\n\n## **L\'Ordine della Stella d\'Oro** (Golden Dawn)\nUn ordine magico che studia la Cabala, l\'alchimia, e la magia cerimoniale. Membri includono artisti, scrittori, e membri dell\'alta società.\n\n## **La Società Teosofica**\nFondata da Madame Blavatsky, esplorano i misteri dell\'Oriente e la saggezza antica. Alcuni membri hanno scoperto verità che avrebbero preferito ignorare.\n\n## **I Custodi del Sigillo**\nUn gruppo segreto che pretende di proteggere l\'umanità dalle antiche minacce. Hanno agenti in tutte le sfere della società.\n\n## **La Confraternita della Luna Nera**\nUn culto dedicato alle divinità oscure. Raramente visti, ma i loro rituali notturni terrorizzano chi li scopre.',
      authorUserId: 'player7',
      authorUsername: 'StudiosoDellOcculto',
      authorCharacterName: 'Madame Vivienne Blackthorne',
      characterId: 'madame-blackthorne-id',
      isEdited: false,
      isDeleted: false,
      isPinned: false
    },
    // More extensive content continues with Victorian life, corporations, investigations, etc.
    // (Additional posts would be added here for a truly comprehensive seed)
  ]
};

async function seedForum() {
  const { client, db } = await getConnection();

  try {
    const now = new Date();
    
    // Clear existing forum data
    console.log('🗑️ Rimozione dati forum esistenti...');
    await db.collection('forum_posts').deleteMany({});
    await db.collection('forum_discussions').deleteMany({});
    await db.collection('forum_topics').deleteMany({});
    
    // Insert topics
    console.log('📝 Creazione argomenti del forum...');
    const topicsToInsert = forumSeedData.topics.map(topic => ({
      ...topic,
      _id: new ObjectId(),
      createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last month
      lastPostAt: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000) // Random date within last day
    }));
    
    await db.collection('forum_topics').insertMany(topicsToInsert);
    console.log(`✅ Creati ${topicsToInsert.length} argomenti`);
    
    // Insert discussions
    console.log('💬 Creazione discussioni del forum...');
    const discussionsToInsert = forumSeedData.discussions.map(discussion => ({
      ...discussion,
      _id: new ObjectId(),
      createdAt: new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random date within last 2 weeks
      lastPostAt: new Date(now.getTime() - Math.random() * 6 * 60 * 60 * 1000) // Random date within last 6 hours
    }));
    
    await db.collection('forum_discussions').insertMany(discussionsToInsert);
    console.log(`✅ Create ${discussionsToInsert.length} discussioni`);
    
    // Insert posts
    console.log('📮 Creazione post del forum...');
    const postsToInsert = forumSeedData.posts.map(post => ({
      ...post,
      _id: new ObjectId(),
      createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random date within last week
    }));
    
    await db.collection('forum_posts').insertMany(postsToInsert);
    console.log(`✅ Creati ${postsToInsert.length} post`);
    
    // Generate additional posts for discussions to make them more realistic
    console.log('📝 Generazione post aggiuntivi per discussioni attive...');
    
    const additionalPosts = [];
    const sampleUsers = [
      { userId: 'player13', username: 'NobildonnaMisteriosa', characterName: 'Duchess Victoria Pembroke', characterId: 'duchess-pembroke' },
      { userId: 'player14', username: 'GiornalistaInquisitore', characterName: 'Samuel Hartington', characterId: 'samuel-hartington' },
      { userId: 'player15', username: 'AntiquarioSavant', characterName: 'Mr. Cornelius Blackwood', characterId: 'cornelius-blackwood' },
      { userId: 'player16', username: 'DonnaDiCarità', characterName: 'Sister Mary Catherine', characterId: 'sister-mary' },
      { userId: 'player17', username: 'ArcheologoAvventuroso', characterName: 'Prof. Henry Whitmore', characterId: 'prof-whitmore' }
    ];
    
    const sampleResponses = [
      'Molto interessante! Questo si collega a quello che ho sentito nei salotti di Mayfair.',
      'La mia esperienza conferma questi dettagli. Ho osservato fenomeni simili.',
      'Suggerisco cautela. Queste questioni possono essere più pericolose di quanto appaiano.',
      'Ho trovato riferimenti simili nei miei studi. Potremmo collaborare su questo.',
      'Questo potrebbe spiegare gli strani eventi di cui parlano i giornali.',
      'La mia congregazione ha menzionato disturbi simili durante le preghiere serali.',
      'I miei contatti a Scotland Yard potrebbero avere informazioni aggiuntive.',
      'Dovremmo organizzare un incontro per discutere questi sviluppi.'
    ];
    
    // Add responses to popular discussions
    const popularDiscussions = ['caso-museum-britannico', 'societa-segrete', 'quartieri-londinesi', 'omicidi-east-end'];
    
    for (const discussionSlug of popularDiscussions) {
      const discussion = discussionsToInsert.find(d => d.slug === discussionSlug);
      if (discussion) {
        const numResponses = Math.floor(Math.random() * 4) + 2; // 2-5 responses
        
        for (let i = 0; i < numResponses; i++) {
          const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
          const randomResponse = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
          
          additionalPosts.push({
            _id: new ObjectId(),
            topicSlug: discussion.topicSlug,
            discussionSlug: discussion.slug,
            content: randomResponse,
            authorUserId: randomUser.userId,
            authorUsername: randomUser.username,
            authorCharacterName: randomUser.characterName,
            authorCharacterId: randomUser.characterId,
            createdAt: new Date(now.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000),
            isEdited: false,
            isDeleted: false,
            isPinned: false
          });
        }
      }
    }
    
    if (additionalPosts.length > 0) {
      await db.collection('forum_posts').insertMany(additionalPosts);
      console.log(`✅ Aggiunti ${additionalPosts.length} post di risposta`);
    }
    
    // Update statistics
    console.log('🔄 Aggiornamento statistiche argomenti...');
    for (const topic of topicsToInsert) {
      const actualPostCount = await db.collection('forum_posts').countDocuments({ topicSlug: topic.slug });
      const latestPost = await db.collection('forum_posts')
        .findOne({ topicSlug: topic.slug }, { sort: { createdAt: -1 } });
      
      await db.collection('forum_topics').updateOne(
        { slug: topic.slug },
        {
          $set: {
            postCount: actualPostCount,
            lastPostAt: latestPost?.createdAt || topic.lastPostAt,
            lastPostBy: latestPost ? {
              userId: latestPost.authorUserId,
              username: latestPost.authorUsername,
              characterName: latestPost.authorCharacterName,
              characterId: latestPost.authorCharacterId
            } : undefined
          }
        }
      );
    }
    
    console.log('🔄 Aggiornamento statistiche discussioni...');
    for (const discussion of discussionsToInsert) {
      const actualPostCount = await db.collection('forum_posts').countDocuments({ discussionSlug: discussion.slug });
      const latestPost = await db.collection('forum_posts')
        .findOne({ discussionSlug: discussion.slug }, { sort: { createdAt: -1 } });
      
      await db.collection('forum_discussions').updateOne(
        { slug: discussion.slug },
        {
          $set: {
            postCount: actualPostCount,
            lastPostAt: latestPost?.createdAt || discussion.lastPostAt,
            lastPostBy: latestPost ? {
              userId: latestPost.authorUserId,
              username: latestPost.authorUsername,
              characterName: latestPost.authorCharacterName,
              characterId: latestPost.authorCharacterId
            } : undefined
          }
        }
      );
    }
    
    const finalPostCount = await db.collection('forum_posts').countDocuments({});
    const finalDiscussionCount = await db.collection('forum_discussions').countDocuments({});
    const finalTopicCount = await db.collection('forum_topics').countDocuments({});
    
    console.log('✅ Seed del forum italiano completato con successo!');
    console.log('\n📊 Statistiche Forum:');
    console.log(`   Argomenti: ${finalTopicCount}`);
    console.log(`   Discussioni: ${finalDiscussionCount}`);
    console.log(`   Post: ${finalPostCount}`);
    console.log(`   Argomenti Pubblici: ${topicsToInsert.filter(t => t.isPublic).length}`);
    console.log(`   Argomenti Privati: ${topicsToInsert.filter(t => !t.isPublic).length}`);
    
  } catch (error) {
    console.error('❌ Errore durante il seed del forum:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  seedForum();
}

export { seedForum };