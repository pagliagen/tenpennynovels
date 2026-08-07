#!/usr/bin/env tsx

import { ObjectId } from 'mongodb';
import { getConnection } from '../utils/connection.js';

// Deterministic ObjectIds for consistent character references across seeds
const CHAR_IDS = {
  narrator: new ObjectId('100000000000000000000001'),
  ladyMargaret: new ObjectId('100000000000000000000002'),
  drHartwell: new ObjectId('100000000000000000000003'),
  profPemberton: new ObjectId('100000000000000000000004'),
  williamThornfield: new ObjectId('100000000000000000000005'),
  sirCogsworth: new ObjectId('100000000000000000000006'),
  inspectorWhitmore: new ObjectId('100000000000000000000007'),
  madameBlackthorne: new ObjectId('100000000000000000000008'),
  drWhitmarsh: new ObjectId('100000000000000000000009'),
  ladyFairfax: new ObjectId('10000000000000000000000a'),
  chefDubois: new ObjectId('10000000000000000000000b'),
  barristerHartwell: new ObjectId('10000000000000000000000c'),
  neofitoMisterioso: new ObjectId('10000000000000000000000d'),
  duchessPembroke: new ObjectId('10000000000000000000000e'),
  samuelHartington: new ObjectId('10000000000000000000000f'),
  corneliusBlackwood: new ObjectId('100000000000000000000010'),
  sisterMary: new ObjectId('100000000000000000000011'),
  profWhitmore: new ObjectId('100000000000000000000012')
};

// Macrocategorie che raggruppano gli argomenti del forum
const forumCategorySeedData = [
  {
    slug: 'comunita',
    title: 'Comunità',
    description: 'Benvenuti, presentazioni e creazione dei personaggi',
    sortOrder: 0,
    color: '#8B4513',
    icon: '🎭'
  },
  {
    slug: 'regole-e-meccaniche',
    title: 'Regole e Meccaniche',
    description: 'Call of Cthulhu, regole della casa e modifiche Vittoriane',
    sortOrder: 1,
    color: '#2E8B57',
    icon: '🎲'
  },
  {
    slug: 'ambientazione',
    title: 'Ambientazione Vittoriana',
    description: 'Londra, vita quotidiana, corporazioni e società del 1890',
    sortOrder: 2,
    color: '#DAA520',
    icon: '🏰'
  },
  {
    slug: 'misteri-e-occulto',
    title: 'Misteri e Occulto',
    description: 'Investigazioni, casi irrisolti e i Miti di Cthulhu',
    sortOrder: 3,
    color: '#800080',
    icon: '🔍'
  },
  {
    slug: 'sessioni-riservate',
    title: 'Sessioni Riservate',
    description: 'Discussioni private per personaggi approvati',
    sortOrder: 4,
    color: '#8B0000',
    icon: '🔒'
  }
];

// Italian Forum seed data - Comprehensive Victorian London RPG content
const forumSeedData = {
  topics: [
    {
      slug: 'benvenuti-a-tenpennynovels',
      title: 'Benvenuti a Ten Penny Novels',
      description: 'Discussioni generali sulla London Vittoriana e il nostro GDR',
      categorySlug: 'comunita',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: true,
      postCount: 8,
      color: '#8B4513',
      icon: '🎭'
    },
    {
      slug: 'creazione-personaggi',
      title: 'Creazione Personaggi',
      description: 'Condividi le tue storie, background e lo sviluppo dei personaggi',
      categorySlug: 'comunita',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 15,
      color: '#4B0082',
      icon: '👤'
    },
    {
      slug: 'meccaniche-di-gioco',
      title: 'Meccaniche di Gioco',
      description: 'Discussioni su Call of Cthulhu, regole della casa e modifiche Vittoriane',
      categorySlug: 'regole-e-meccaniche',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 12,
      color: '#2E8B57',
      icon: '🎲'
    },
    {
      slug: 'londra-vittoriana',
      title: 'Londra Vittoriana',
      description: 'Storia, cultura e ambientazione della London del 1890',
      categorySlug: 'ambientazione',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 20,
      color: '#DAA520',
      icon: '🏰'
    },
    {
      slug: 'investigazioni',
      title: 'Investigazioni e Misteri',
      description: 'Casi, indagini e misteri da risolvere nella nebbia londinese',
      categorySlug: 'misteri-e-occulto',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 18,
      color: '#8B4513',
      icon: '🔍'
    },
    {
      slug: 'occultismo-cthulhu',
      title: 'Occultismo e Miti di Cthulhu',
      description: 'Discussioni sui Grandi Antichi e l\'occulto nell\'era Vittoriana',
      categorySlug: 'misteri-e-occulto',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 22,
      color: '#800080',
      icon: '👁️'
    },
    {
      slug: 'vita-quotidiana',
      title: 'Vita Quotidiana Vittoriana',
      description: 'Costumi, tradizioni e la vita di tutti i giorni nel 1890',
      categorySlug: 'ambientazione',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 16,
      color: '#A0522D',
      icon: '☕'
    },
    {
      slug: 'corporazioni-e-societa',
      title: 'Corporazioni e Società',
      description: 'Discussioni sulle corporazioni, gilde e società segrete',
      categorySlug: 'ambientazione',
      isPublic: true,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 14,
      color: '#B8860B',
      icon: '🏛️'
    },
    {
      slug: 'sessioni-private',
      title: 'Sessioni Private',
      description: 'Discussioni private per personaggi approvati',
      categorySlug: 'sessioni-riservate',
      isPublic: false,
      isVisible: true,
      isLocked: false,
      isPinned: false,
      postCount: 9,
      color: '#8B0000',
      icon: '🔒'
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
      createdByChar: 'narrator'
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
      createdByChar: 'narrator'
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
      createdByChar: 'narrator'
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
      createdByChar: 'ladyMargaret'
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
      createdByChar: 'narrator'
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
      createdByChar: 'drHartwell'
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
      createdByChar: 'narrator'
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
      createdByChar: 'profPemberton'
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
      createdByChar: 'williamThornfield'
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
      createdByChar: 'narrator'
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
      createdByChar: 'sirCogsworth'
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
      createdByChar: 'narrator'
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
      createdByChar: 'inspectorWhitmore'
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
      createdByChar: 'madameBlackthorne'
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
      createdByChar: 'drWhitmarsh'
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
      createdByChar: 'ladyFairfax'
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
      createdByChar: 'chefDubois'
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
      createdByChar: 'narrator'
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
      createdByChar: 'barristerHartwell'
    }
  ],
  // Extensive Italian posts content
  posts: [
    // Benvenuti posts
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'benvenuti-nuovi-giocatori',
      content: 'Benvenuti a Ten Penny Novels, la nostra comunità dedicata al GDR Call of Cthulhu ambientato nella Londra Vittoriana! Questo è un luogo dove potete immergervi nelle strade nebbiose della London del 1890, creare personaggi avvincenti e partecipare ad avventure misteriose.\n\nChe siate investigatori esperti o nuovi al mondo di Cthulhu, tutti sono benvenuti qui. Per favore, prendetevi del tempo per leggere le nostre regole e presentarvi alla comunità.',
      authorChar: 'narrator',
      authorName: 'Il Narratore',
      isEdited: false,
      isDeleted: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'benvenuti-nuovi-giocatori',
      content: 'Ricordatevi di creare i vostri personaggi seguendo le linee guida dell\'epoca Vittoriana. La verosimiglianza storica è importante per mantenere l\'atmosfera immersiva del gioco!',
      authorChar: 'ladyMargaret',
      authorName: 'Lady Margaret Ashworth',
      isEdited: false,
      isDeleted: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'regole-del-forum',
      content: '# Regole del Forum e Linee Guida\n\n1. **Rispetto Reciproco**: Trattate tutti i membri della comunità con rispetto e cortesia.\n2. **Rimanete nel Personaggio**: Quando scrivete nei panni del vostro personaggio, mantenete l\'atmosfera Vittoriana.\n3. **Niente Spoiler**: Usate i tag spoiler quando discutete elementi della trama.\n4. **Accuratezza Storica**: Mantenete l\'accuratezza storica quando possibile.\n5. **Divertitevi**: Ricordate, siamo qui per divertirci e raccontare grandi storie insieme!\n\n## Regole Specifiche per il Roleplay\n- Rispettate le differenze di classe sociale dell\'epoca\n- I personaggi devono agire secondo i valori e le conoscenze del 1890\n- Le donne hanno limitazioni sociali dell\'epoca (ma possono essere creative nel superarle!)\n- La tecnologia è limitata a quella disponibile nel 1890',
      authorChar: 'narrator',
      authorName: 'Il Narratore',
      isEdited: false,
      isDeleted: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'presentazioni',
      content: 'Vi prego di presentarvi alla comunità! Raccontateci qualcosa di voi, la vostra esperienza con i GDR, e cosa vi attira dei misteri della Londra Vittoriana.',
      authorChar: 'narrator',
      authorName: 'Il Narratore',
      isEdited: false,
      isDeleted: false
    },
    {
      topicSlug: 'benvenuti-a-tenpennynovels',
      discussionSlug: 'presentazioni',
      content: 'Salve a tutti! Sono nuovo nel mondo di Call of Cthulhu ma sono affascinato dall\'atmosfera Vittoriana. Ho sempre amato i romanzi di Arthur Conan Doyle e sono entusiasta di creare il mio investigatore!',
      authorChar: 'neofitoMisterioso',
      authorName: 'Neofito Misterioso',
      isEdited: false,
      isDeleted: false
    },
    // Detective character posts
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'detective-vittoriano',
      content: 'Ho creato l\'Ispettore Thomas Blackwood di Scotland Yard. È un detective di mezza età che ha visto troppo durante la sua carriera. Ha iniziato a notare connessioni inquietanti tra casi apparentemente non collegati, portandolo nel mondo dell\'occulto.\n\nLe sue specialità includono Investigare, Psicologia e Trovare Oggetti Nascosti. La sua esperienza nella polizia gli dà accesso a informazioni e luoghi che altri non possono raggiungere.',
      authorChar: 'ladyMargaret',
      authorName: 'Lady Margaret Ashworth',
      isEdited: false,
      isDeleted: false
    },
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'detective-vittoriano',
      content: 'Ottimo concept! Ho pensato che potrebbe avere una connessione con il mio personaggio, Dr. Hartwell. Forse si sono incontrati durante un caso di omicidio dove la sanità mentale dell\'assassino era in questione?',
      authorChar: 'drHartwell',
      authorName: 'Dr. Edmund Hartwell',
      isEdited: false,
      isDeleted: false
    },
    // Character creation tips
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'consigli-creazione',
      content: 'Ecco alcuni consigli per creare personaggi Vittoriani convincenti:\n\n## Ricerca Storica\n- Studiate il sistema delle classi sociali della London del 1890\n- Considerate come l\'occupazione del vostro personaggio influenzi la sua vita quotidiana\n- Pensate alle relazioni familiari e sociali\n- Non dimenticate gli elementi soprannaturali - come reagisce il vostro personaggio all\'ignoto?\n\n## Autenticità dell\'Epoca\n- La maggior parte delle persone di quest\'epoca erano molto religiose e superstiziose\n- Le donne avevano ruoli sociali limitati ma potevano essere creative\n- La medicina era primitiva rispetto agli standard moderni\n- La comunicazione era lenta - niente telefoni per la maggior parte delle persone!',
      authorChar: 'narrator',
      authorName: 'Il Narratore',
      isEdited: false,
      isDeleted: false
    },
    // Medical character background
    {
      topicSlug: 'creazione-personaggi',
      discussionSlug: 'medico-alienista',
      content: 'Presento il Dr. Edmund Hartwell, medico alienista presso il Bethlem Royal Hospital (Bedlam). È specializzato nel trattamento dei disturbi mentali e ha sviluppato teorie controverse sui collegamenti tra follia e esperienze soprannaturali.\n\nDopo aver curato diversi pazienti che raccontavano storie simili di "orrori cosmici", ha iniziato a sospettare che non tutti fossero semplicemente folli. Le sue competenze includono Medicina, Psicologia e Biblioteca - ha una vasta collezione di testi medici e psichiatrici.',
      authorChar: 'drHartwell',
      authorName: 'Dr. Edmund Hartwell',
      isEdited: false,
      isDeleted: false
    },
    // Game mechanics discussions
    {
      topicSlug: 'meccaniche-di-gioco',
      discussionSlug: 'regole-della-casa',
      content: 'Le nostre regole della casa per l\'ambientazione Vittoriana:\n\n## Status Sociale\n1. **Le Classi Contano**: Personaggi di diverse classi sociali hanno accesso diverso a informazioni e luoghi.\n2. **Codici di Abbigliamento**: L\'abbigliamento appropriato è necessario per accedere a certi ambienti.\n3. **Genere e Società**: Le donne affrontano restrizioni sociali ma possono usare la creatività per superarle.\n\n## Recupero Sanità Mentale\n- **Attività Vittoriane**: Tè pomeridiano, lettura, musica classica\n- **Vacanze**: Viaggi in campagna o alle terme\n- **Religione**: La preghiera e la frequentazione della chiesa possono aiutare\n\n## Limitazioni Tecnologiche\n- Ricordate i vincoli tecnologici del 1890\n- Niente elettricità nella maggior parte delle case\n- Comunicazioni lente - lettere e telegrammi\n- Medicina primitiva',
      authorChar: 'narrator',
      authorName: 'Il Narratore',
      isEdited: false,
      isDeleted: false
    },
    // Victorian London geography
    {
      topicSlug: 'londra-vittoriana',
      discussionSlug: 'quartieri-londinesi',
      content: 'Una guida ai principali quartieri di Londra nell\'era Vittoriana:\n\n## **Mayfair** - Il Cuore dell\'Aristocrazia\nDove vivono i ricchi e potenti. Eleganti townhouse, club esclusivi, e la migliore società londinese.\n\n## **Whitechapel** - L\'East End Pericoloso\nUn labirinto di vicoli stretti, taverne fumose, e criminalità. Casa della classe operaia e dei più disperati.\n\n## **Westminster** - Il Centro del Potere\nParlamento, Whitehall, e gli uffici governativi. Il cuore politico dell\'Impero.\n\n## **Bloomsbury** - Gli Intellettuali\nUniversità, musei (incluso il British Museum), e la casa di scrittori e pensatori.\n\n## **La City** - Il Centro Finanziario\nBanche, compagnie assicurative, e il commercio dell\'Impero. Affollato di giorno, deserto di notte.',
      authorChar: 'williamThornfield',
      authorName: 'William Thornfield',
      isEdited: false,
      isDeleted: false
    },
    // British Museum mystery
    {
      topicSlug: 'investigazioni',
      discussionSlug: 'caso-museum-britannico',
      content: 'È stato segnalato uno strano caso al British Museum. Diversi artefatti egiziani sono scomparsi dalle collezioni, ma non sembra un furto ordinario. I custodi notturni parlano di "sussurri" e "ombre che si muovono" nelle sale egizie dopo il tramonto.\n\nL\'investigazione ufficiale non ha portato a nulla, ma ci sono dettagli inquietanti:\n- I furti avvengono solo durante le notti di luna nuova\n- Gli artefatti rubati sono tutti legati alla morte e all\'aldilà\n- Un custode è stato trovato in stato catatonico, mormorando in una lingua sconosciuta\n\nChi è interessato a investigare questo mistero?',
      authorChar: 'narrator',
      authorName: 'Il Narratore',
      isEdited: false,
      isDeleted: false
    },
    // Occult societies
    {
      topicSlug: 'occultismo-cthulhu',
      discussionSlug: 'societa-segrete',
      content: 'Le società segrete fioriscono nell\'ombra della Londra Vittoriana. Ecco alcune delle più note (e temute):\n\n## **L\'Ordine della Stella d\'Oro** (Golden Dawn)\nUn ordine magico che studia la Cabala, l\'alchimia, e la magia cerimoniale. Membri includono artisti, scrittori, e membri dell\'alta società.\n\n## **La Società Teosofica**\nFondata da Madame Blavatsky, esplorano i misteri dell\'Oriente e la saggezza antica. Alcuni membri hanno scoperto verità che avrebbero preferito ignorare.\n\n## **I Custodi del Sigillo**\nUn gruppo segreto che pretende di proteggere l\'umanità dalle antiche minacce. Hanno agenti in tutte le sfere della società.\n\n## **La Confraternita della Luna Nera**\nUn culto dedicato alle divinità oscure. Raramente visti, ma i loro rituali notturni terrorizzano chi li scopre.',
      authorChar: 'madameBlackthorne',
      authorName: 'Madame Vivienne Blackthorne',
      isEdited: false,
      isDeleted: false
    }
  ]
};

const CHAR_NAMES: Record<keyof typeof CHAR_IDS, string> = {
  narrator: 'Il Narratore',
  ladyMargaret: 'Lady Margaret Ashworth',
  drHartwell: 'Dr. Edmund Hartwell',
  profPemberton: 'Prof. Aldrich Pemberton',
  williamThornfield: 'William Thornfield',
  sirCogsworth: 'Sir Reginald Cogsworth',
  inspectorWhitmore: 'Inspector Charles Whitmore',
  madameBlackthorne: 'Madame Vivienne Blackthorne',
  drWhitmarsh: 'Dr. Algernon Whitmarsh',
  ladyFairfax: 'Lady Arabella Fairfax',
  chefDubois: 'Monsieur Auguste Dubois',
  barristerHartwell: 'Barrister Jonathan Hartwell',
  neofitoMisterioso: 'Neofito Misterioso',
  duchessPembroke: 'Duchess Victoria Pembroke',
  samuelHartington: 'Samuel Hartington',
  corneliusBlackwood: 'Mr. Cornelius Blackwood',
  sisterMary: 'Sister Mary Catherine',
  profWhitmore: 'Prof. Henry Whitmore'
};

function getAuthor(charKey: keyof typeof CHAR_IDS) {
  return {
    characterId: CHAR_IDS[charKey],
    characterName: CHAR_NAMES[charKey]
  };
}

async function seedForum() {
  const { client, db } = await getConnection();

  try {
    const now = new Date();

    // Clear existing forum data
    console.log('🗑️ Rimozione dati forum esistenti...');
    await db.collection('forum_posts').deleteMany({});
    await db.collection('forum_discussions').deleteMany({});
    await db.collection('forum_topics').deleteMany({});
    await db.collection('forum_categories').deleteMany({});

    // Insert categories
    console.log('🗂️ Creazione categorie del forum...');
    const categoriesToInsert = forumCategorySeedData.map((category) => ({
      ...category,
      _id: new ObjectId(),
      isVisible: true,
      defaultAccessRules: [{ type: 'public' }],
      createdAt: now,
      createdBy: getAuthor('narrator')
    }));

    await db.collection('forum_categories').insertMany(categoriesToInsert);
    console.log(`✅ Create ${categoriesToInsert.length} categorie`);

    const categorySlugToId = new Map<string, ObjectId>();
    for (const c of categoriesToInsert) {
      categorySlugToId.set(c.slug, c._id);
    }

    // Insert topics with new structure
    console.log('📝 Creazione argomenti del forum...');
    const topicsToInsert = forumSeedData.topics.map((topic, index) => {
      const { isPublic, categorySlug, ...rest } = topic;
      const categoryId = categorySlugToId.get(categorySlug);
      if (!categoryId) throw new Error(`Category not found: ${categorySlug}`);
      return {
        ...rest,
        categoryId,
        categorySlug,
        _id: new ObjectId(),
        sortOrder: index,
        accessRules: isPublic ? [{ type: 'public' }] : [{ type: 'authenticated' }],
        discussionCount: 0,
        createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        lastPostAt: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
        createdBy: getAuthor('narrator')
      };
    });

    await db.collection('forum_topics').insertMany(topicsToInsert);
    console.log(`✅ Creati ${topicsToInsert.length} argomenti`);

    // Build topic slug -> _id map
    const topicSlugToId = new Map<string, ObjectId>();
    for (const t of topicsToInsert) {
      topicSlugToId.set(t.slug, t._id);
    }

    // Insert discussions with topicId and new createdBy
    console.log('💬 Creazione discussioni del forum...');
    const discussionsToInsert = forumSeedData.discussions.map((d) => {
      const topicId = topicSlugToId.get(d.topicSlug);
      if (!topicId) throw new Error(`Topic not found: ${d.topicSlug}`);
      const charKey = d.createdByChar as keyof typeof CHAR_IDS;
      return {
        slug: d.slug,
        topicId,
        topicSlug: d.topicSlug,
        title: d.title,
        isPinned: d.isPinned,
        isLocked: d.isLocked,
        isVisible: d.isVisible,
        postCount: d.postCount,
        subscriberCount: 0,
        viewCount: d.viewCount ?? 0,
        tags: d.tags,
        _id: new ObjectId(),
        createdAt: new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000),
        lastPostAt: new Date(now.getTime() - Math.random() * 6 * 60 * 60 * 1000),
        createdBy: getAuthor(charKey)
      };
    });

    await db.collection('forum_discussions').insertMany(discussionsToInsert);
    console.log(`✅ Create ${discussionsToInsert.length} discussioni`);

    // Build discussion slug -> _id map (per topicSlug+discussionSlug per disambiguare)
    const discussionKeyToId = new Map<string, ObjectId>();
    for (const d of discussionsToInsert) {
      discussionKeyToId.set(`${d.topicSlug}:${d.slug}`, d._id);
    }

    // Insert posts with topicId, discussionId, author
    console.log('📮 Creazione post del forum...');
    const postsToInsert = forumSeedData.posts.map((post) => {
      const topicId = topicSlugToId.get(post.topicSlug);
      const discussionId = discussionKeyToId.get(`${post.topicSlug}:${post.discussionSlug}`);
      if (!topicId || !discussionId) throw new Error(`Topic/Discussion not found: ${post.topicSlug}/${post.discussionSlug}`);
      const charKey = post.authorChar as keyof typeof CHAR_IDS;
      return {
        _id: new ObjectId(),
        topicId,
        discussionId,
        topicSlug: post.topicSlug,
        discussionSlug: post.discussionSlug,
        content: post.content,
        author: getAuthor(charKey),
        createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        isEdited: post.isEdited,
        isDeleted: post.isDeleted,
        reactionCounts: { like: 0, love: 0, laugh: 0, think: 0 }
      };
    });

    await db.collection('forum_posts').insertMany(postsToInsert);
    console.log(`✅ Creati ${postsToInsert.length} post`);

    // Generate additional posts for discussions to make them more realistic
    console.log('📝 Generazione post aggiuntivi per discussioni attive...');

    const sampleChars: Array<keyof typeof CHAR_IDS> = [
      'duchessPembroke',
      'samuelHartington',
      'corneliusBlackwood',
      'sisterMary',
      'profWhitmore'
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

    const popularDiscussions = ['caso-museum-britannico', 'societa-segrete', 'quartieri-londinesi', 'omicidi-east-end'];
    const additionalPosts: Array<{
      _id: ObjectId;
      topicId: ObjectId;
      discussionId: ObjectId;
      topicSlug: string;
      discussionSlug: string;
      content: string;
      author: { characterId: ObjectId; characterName: string };
      createdAt: Date;
      isEdited: boolean;
      isDeleted: boolean;
      reactionCounts: { like: number; love: number; laugh: number; think: number };
    }> = [];

    for (const discussionSlug of popularDiscussions) {
      const discussion = discussionsToInsert.find((d) => d.slug === discussionSlug);
      if (discussion) {
        const numResponses = Math.floor(Math.random() * 4) + 2;

        for (let i = 0; i < numResponses; i++) {
          const randomChar = sampleChars[Math.floor(Math.random() * sampleChars.length)];
          const randomResponse = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];

          additionalPosts.push({
            _id: new ObjectId(),
            topicId: discussion.topicId,
            discussionId: discussion._id,
            topicSlug: discussion.topicSlug,
            discussionSlug: discussion.slug,
            content: randomResponse,
            author: getAuthor(randomChar),
            createdAt: new Date(now.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000),
            isEdited: false,
            isDeleted: false,
            reactionCounts: { like: 0, love: 0, laugh: 0, think: 0 }
          });
        }
      }
    }

    if (additionalPosts.length > 0) {
      await db.collection('forum_posts').insertMany(additionalPosts);
      console.log(`✅ Aggiunti ${additionalPosts.length} post di risposta`);
    }

    // Update topic statistics (discussionCount, postCount, lastPostAt, lastPostBy)
    console.log('🔄 Aggiornamento statistiche argomenti...');
    for (const topic of topicsToInsert) {
      const actualPostCount = await db.collection('forum_posts').countDocuments({ topicId: topic._id });
      const discussionCount = await db.collection('forum_discussions').countDocuments({ topicId: topic._id });
      const latestPost = await db.collection('forum_posts').findOne(
        { topicId: topic._id },
        { sort: { createdAt: -1 } }
      );

      await db.collection('forum_topics').updateOne(
        { _id: topic._id },
        {
          $set: {
            postCount: actualPostCount,
            discussionCount,
            lastPostAt: latestPost?.createdAt ?? topic.lastPostAt,
            ...(latestPost?.author && {
              lastPostBy: {
                characterId: latestPost.author.characterId,
                characterName: latestPost.author.characterName
              }
            })
          }
        }
      );
    }

    // Update discussion statistics
    console.log('🔄 Aggiornamento statistiche discussioni...');
    for (const discussion of discussionsToInsert) {
      const actualPostCount = await db.collection('forum_posts').countDocuments({ discussionId: discussion._id });
      const latestPost = await db.collection('forum_posts').findOne(
        { discussionId: discussion._id },
        { sort: { createdAt: -1 } }
      );

      await db.collection('forum_discussions').updateOne(
        { _id: discussion._id },
        {
          $set: {
            postCount: actualPostCount,
            lastPostAt: latestPost?.createdAt ?? discussion.lastPostAt,
            ...(latestPost?.author && {
              lastPostBy: {
                characterId: latestPost.author.characterId,
                characterName: latestPost.author.characterName
              }
            })
          }
        }
      );
    }

    const finalPostCount = await db.collection('forum_posts').countDocuments({});
    const finalDiscussionCount = await db.collection('forum_discussions').countDocuments({});
    const finalTopicCount = await db.collection('forum_topics').countDocuments({});
    const publicTopics = topicsToInsert.filter((t) => t.accessRules.some((r) => r.type === 'public')).length;
    const privateTopics = topicsToInsert.filter((t) => t.accessRules.some((r) => r.type === 'authenticated')).length;

    console.log('✅ Seed del forum italiano completato con successo!');
    console.log('\n📊 Statistiche Forum:');
    console.log(`   Argomenti: ${finalTopicCount}`);
    console.log(`   Discussioni: ${finalDiscussionCount}`);
    console.log(`   Post: ${finalPostCount}`);
    console.log(`   Argomenti Pubblici: ${publicTopics}`);
    console.log(`   Argomenti Privati: ${privateTopics}`);
  } catch (error) {
    console.error('❌ Errore durante il seed del forum:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedForum();

export { seedForum };
