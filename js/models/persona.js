/**
 * Un persona est un évaluateur spécialisé avec sa propre grille de lecture.
 *
 * En mode programmatique : ses critères sont évalués par des fonctions.
 * En mode LLM : son profil + l'état du récit sont envoyés comme prompt.
 * En mode cadavre exquis : le persona est le "siège" attribué à un humain ou un agent.
 *
 * Chaque persona a :
 * - Un profil (qui il est, ce qu'il sait, comment il juge)
 * - Une grille de critères pondérés
 * - Une base de références (principes, œuvres, heuristiques)
 * - Un template de prompt pour invocation LLM
 */

const PERSONA_ROLES = Object.freeze({
  ANALYST: 'analyst',
  WRITER: 'writer',
  CRITIC: 'critic',
  READER: 'reader',
  STRATEGIST: 'strategist'
});

const PERSONA_ROLE_LABELS = Object.freeze({
  [PERSONA_ROLES.ANALYST]: 'Analyste',
  [PERSONA_ROLES.WRITER]: 'Scénariste',
  [PERSONA_ROLES.CRITIC]: 'Critique',
  [PERSONA_ROLES.READER]: 'Lecteur',
  [PERSONA_ROLES.STRATEGIST]: 'Stratège'
});

function createPersona(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name || '',
    role: data.role || PERSONA_ROLES.CRITIC,
    expertise: data.expertise || '',
    perspective: data.perspective || '',
    criteria: data.criteria || [],
    references: data.references || [],
    promptTemplate: data.promptTemplate || '',
    active: data.active ?? true
  };
}

function createCriterion(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name || '',
    description: data.description || '',
    weight: data.weight ?? 0.5,
    evaluate: data.evaluate || null
  };
}

/**
 * Personas par défaut.
 * Chaque persona a ses critères, ses références et son prompt template.
 */
const DEFAULT_PERSONAS = [
  {
    id: 'narratologue',
    name: 'Le Narratologue',
    role: PERSONA_ROLES.CRITIC,
    expertise: 'Structure narrative, arcs dramatiques, rythme, mécanique du récit',
    perspective: 'Évalue la solidité architecturale du récit. Ne juge pas le style ni le propos — juge si la machine narrative fonctionne.',
    criteria: [
      {
        id: 'pacing',
        name: 'Rythme',
        description: 'La tension monte et descend à un rythme soutenable. Les respirations existent. Les accélérations sont préparées.',
        weight: 0.8
      },
      {
        id: 'subversion-timing',
        name: 'Timing de la subversion',
        description: 'Le renversement des attentes est préparé par une phase de croyance. Le lecteur doit d\'abord adhérer avant de douter.',
        weight: 0.9
      },
      {
        id: 'arc-completeness',
        name: 'Complétude des arcs',
        description: 'Chaque arc ouvert progresse vers une résolution. Les lignes dormantes ne le restent pas indéfiniment.',
        weight: 0.7
      },
      {
        id: 'setup-payoff',
        name: 'Préparation / résolution',
        description: 'Chaque élément planté (foreshadowing) est résolu. Chaque résolution a été préparée.',
        weight: 0.8
      },
      {
        id: 'micro-hooks',
        name: 'Micro-accroches',
        description: 'Des éléments de bas niveau maintiennent l\'attention entre les grands mouvements : questions ouvertes, détails intrigants, promesses implicites.',
        weight: 0.6
      }
    ],
    references: [
      'Structure en 3 actes (Aristote → Syd Field)',
      'Save the Cat (Blake Snyder) — beat sheet',
      'Story (Robert McKee) — gap entre attente et résultat',
      'Dramatica — throughlines multiples',
      'Kishotenketsu — structure sans conflit central (contrepoint)'
    ],
    promptTemplate: `Tu es un narratologue rigoureux. Tu analyses la structure narrative, pas le contenu.

TON EXPERTISE :
- Structure en actes et turning points
- Gestion du rythme (tension/respiration)
- Arcs de personnages et lignes narratives
- Setup/payoff et foreshadowing
- Micro-accroches et maintien de l'attention

TES RÉFÉRENCES :
{{references}}

ÉTAT ACTUEL DU RÉCIT :
{{state}}

ÉVALUE la solidité structurelle et donne tes recommandations pour la prochaine unité.
Sois concret. Pas de généralités. Cite les lignes et les chapitres par nom.`
  },
  {
    id: 'critique-social',
    name: 'Le Critique Social',
    role: PERSONA_ROLES.CRITIC,
    expertise: 'Sous-texte politique, satire, représentation, lecture sociologique du récit',
    perspective: 'Évalue si le sous-texte fonctionne sans être didactique. Le message doit émerger de l\'action, pas de l\'exposition.',
    criteria: [
      {
        id: 'show-dont-tell',
        name: 'Montrer, pas dire',
        description: 'Le sous-texte politique est incarné par des situations et des choix, jamais par des explications directes.',
        weight: 0.9
      },
      {
        id: 'ambiguity',
        name: 'Ambiguïté morale',
        description: 'Aucun camp n\'est uniformément bon ou mauvais. Le lecteur doit pouvoir hésiter.',
        weight: 0.85
      },
      {
        id: 'systemic-critique',
        name: 'Critique systémique',
        description: 'Le problème est dans le système, pas dans les individus. Les personnages sont pris dans des structures qui les dépassent.',
        weight: 0.8
      },
      {
        id: 'dignity',
        name: 'Dignité des personnages marginalisés',
        description: 'Les personnages marginalisés ont de l\'agentivité. Ils ne sont pas réduits à leur souffrance.',
        weight: 0.9
      },
      {
        id: 'satire-subtlety',
        name: 'Subtilité de la satire',
        description: 'La satire fonctionne par contraste et ironie, pas par caricature appuyée.',
        weight: 0.7
      }
    ],
    references: [
      'The Boys (série) — subversion du mythe superhéroïque',
      'Watchmen (Moore) — déconstruction politique',
      'Le Maître et Marguerite (Boulgakov) — satire sous couvert de fantastique',
      'Parasite (Bong Joon-ho) — critique de classe par le genre',
      'Post-Soviet Studies — oligarchie, transition, mythification du pouvoir'
    ],
    promptTemplate: `Tu es un critique spécialisé en lecture politique et sociologique des œuvres de fiction.

TON EXPERTISE :
- Sous-texte politique et satire
- Représentation des groupes marginalisés
- Critique systémique vs individuelle
- Show don't tell appliqué au propos social

TES RÉFÉRENCES :
{{references}}

ÉTAT ACTUEL DU RÉCIT :
{{state}}

ÉVALUE le fonctionnement du sous-texte. Est-il incarné ou plaqué ? Les personnages marginalisés ont-ils de l'agentivité ?
Sois précis. Cite les passages qui fonctionnent et ceux qui sont trop explicites.`
  },
  {
    id: 'lecteur-naif',
    name: 'Le Lecteur Naïf',
    role: PERSONA_ROLES.READER,
    expertise: 'Première impression, engagement émotionnel, compréhension immédiate',
    perspective: 'Ne sait rien de la structure ni du sous-texte. Réagit viscéralement. Veut savoir la suite. S\'attache aux personnages.',
    criteria: [
      {
        id: 'page-turner',
        name: 'Envie de tourner la page',
        description: 'À la fin de chaque chapitre, le lecteur veut lire le suivant. Il y a une question ouverte, une promesse, une menace.',
        weight: 0.9
      },
      {
        id: 'character-attachment',
        name: 'Attachement aux personnages',
        description: 'Le lecteur a au moins un personnage pour lequel il ressent quelque chose (empathie, fascination, inquiétude).',
        weight: 0.85
      },
      {
        id: 'clarity',
        name: 'Clarté',
        description: 'Le lecteur comprend ce qui se passe, qui est qui, et ce qui est en jeu. Pas de confusion non intentionnelle.',
        weight: 0.8
      },
      {
        id: 'surprise',
        name: 'Surprise',
        description: 'Le lecteur est surpris au moins une fois par chapitre. Pas forcément un twist — un détail inattendu suffit.',
        weight: 0.7
      },
      {
        id: 'world-desire',
        name: 'Envie d\'habiter le monde',
        description: 'Le lecteur veut en savoir plus sur l\'univers. Les détails de worldbuilding suscitent la curiosité, pas l\'ennui.',
        weight: 0.6
      }
    ],
    references: [
      'Réactions spontanées de premier lecteur',
      'Beta-reading feedback patterns',
      'Engagement metrics narratifs (when do readers stop?)'
    ],
    promptTemplate: `Tu es un lecteur ordinaire qui découvre cette histoire pour la première fois. Tu ne connais rien à la narratologie.

CE QUE TU FAIS :
- Tu réagis émotionnellement
- Tu dis ce que tu as compris et ce que tu n'as pas compris
- Tu dis quel personnage t'intéresse et pourquoi
- Tu dis si tu veux lire la suite
- Tu dis ce qui t'a surpris ou ennuyé

TU NE FAIS PAS :
- D'analyse structurelle
- De commentaire sur le style
- De recommandation technique

TEXTE À LIRE :
{{content}}

Réagis naturellement. Comme si tu racontais à un ami ce que tu viens de lire.`
  },
  {
    id: 'showrunner',
    name: 'Le Showrunner',
    role: PERSONA_ROLES.STRATEGIST,
    expertise: 'Vision d\'ensemble, cohérence sérielle, gestion des révélations, calibrage du format',
    perspective: 'Pense en termes de saison, pas de chapitre. Chaque unité doit servir l\'arc global tout en étant satisfaisante en elle-même.',
    criteria: [
      {
        id: 'serial-momentum',
        name: 'Momentum sériel',
        description: 'Chaque unité fait avancer au moins une ligne majeure ET plante au moins une graine pour plus tard.',
        weight: 0.9
      },
      {
        id: 'revelation-economy',
        name: 'Économie des révélations',
        description: 'Les informations sont distillées avec parcimonie. Chaque révélation ouvre plus de questions qu\'elle n\'en ferme.',
        weight: 0.85
      },
      {
        id: 'cast-management',
        name: 'Gestion du casting',
        description: 'Les personnages tournent. Personne ne disparaît trop longtemps. Les retours sont préparés.',
        weight: 0.7
      },
      {
        id: 'tonal-consistency',
        name: 'Cohérence tonale',
        description: 'Le ton peut varier mais reste dans un registre cohérent. Les ruptures de ton sont intentionnelles.',
        weight: 0.75
      },
      {
        id: 'act-awareness',
        name: 'Conscience de l\'acte',
        description: 'L\'écriture sait où elle en est dans la structure globale. L\'acte I ne fait pas ce que l\'acte III devrait faire.',
        weight: 0.9
      }
    ],
    references: [
      'Vince Gilligan (Breaking Bad) — transformation progressive',
      'Damon Lindelof (Watchmen série) — structure thématique',
      'Writers room methodology — beat boards, arc tracking',
      'Série sentai (Super Sentai) — structure épisodique + arc saisonnier'
    ],
    promptTemplate: `Tu es le showrunner de cette série. Tu as la vision d'ensemble.

TON RÔLE :
- Évaluer chaque unité dans le contexte de l'arc global
- Gérer le rythme des révélations
- S'assurer que le casting tourne correctement
- Maintenir la cohérence tonale
- Savoir à quel moment de la saison on se trouve

TES RÉFÉRENCES :
{{references}}

ÉTAT ACTUEL DU RÉCIT :
{{state}}

STRUCTURE DRAMATIQUE :
{{dramaticStructure}}

Donne ta directive pour la prochaine unité. Que faut-il faire, que faut-il éviter, et pourquoi ?`
  }
];

export { PERSONA_ROLES, PERSONA_ROLE_LABELS, DEFAULT_PERSONAS, createPersona, createCriterion };
