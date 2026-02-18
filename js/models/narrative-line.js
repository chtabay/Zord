const LINE_STATUSES = Object.freeze({
  DORMANT: 'dormant',
  EMERGING: 'emerging',
  ACTIVE: 'active',
  CLIMAX: 'climax',
  RESOLVING: 'resolving',
  RESOLVED: 'resolved'
});

const STATUS_LABELS = Object.freeze({
  [LINE_STATUSES.DORMANT]: 'Dormante',
  [LINE_STATUSES.EMERGING]: 'Émergente',
  [LINE_STATUSES.ACTIVE]: 'Active',
  [LINE_STATUSES.CLIMAX]: 'Climax',
  [LINE_STATUSES.RESOLVING]: 'En résolution',
  [LINE_STATUSES.RESOLVED]: 'Résolue'
});

const STATUS_URGENCY_MULTIPLIER = Object.freeze({
  [LINE_STATUSES.DORMANT]: 0.3,
  [LINE_STATUSES.EMERGING]: 0.6,
  [LINE_STATUSES.ACTIVE]: 1.0,
  [LINE_STATUSES.CLIMAX]: 1.5,
  [LINE_STATUSES.RESOLVING]: 1.2,
  [LINE_STATUSES.RESOLVED]: 0.0
});

/**
 * Niveau hiérarchique d'une ligne narrative.
 * Détermine son impact sur la tension globale et son rôle structurel.
 */
const LINE_LEVELS = Object.freeze({
  MAJOR: 'major',
  SECONDARY: 'secondary',
  MICRO: 'micro'
});

const LINE_LEVEL_LABELS = Object.freeze({
  [LINE_LEVELS.MAJOR]: 'Arc majeur',
  [LINE_LEVELS.SECONDARY]: 'Sous-intrigue',
  [LINE_LEVELS.MICRO]: 'Micro-accroche'
});

/**
 * Fonction narrative d'une ligne.
 * Décrit POURQUOI cette ligne existe dans le récit, pas ce qu'elle raconte.
 */
const LINE_FUNCTIONS = Object.freeze({
  TENSION: 'tension',
  RELIEF: 'relief',
  FORESHADOWING: 'foreshadowing',
  RED_HERRING: 'red_herring',
  CONNECTOR: 'connector',
  CATALYST: 'catalyst',
  THEME_CARRIER: 'theme_carrier'
});

const LINE_FUNCTION_LABELS = Object.freeze({
  [LINE_FUNCTIONS.TENSION]: 'Tension — crée ou escalade le conflit',
  [LINE_FUNCTIONS.RELIEF]: 'Respiration — relâche la pression (humour, tendresse, worldbuilding)',
  [LINE_FUNCTIONS.FORESHADOWING]: 'Amorçage — plante des graines pour plus tard',
  [LINE_FUNCTIONS.RED_HERRING]: 'Leurre — détourne l\'attention du lecteur',
  [LINE_FUNCTIONS.CONNECTOR]: 'Connecteur — fait le pont entre d\'autres lignes',
  [LINE_FUNCTIONS.CATALYST]: 'Catalyseur — existe pour provoquer des changements ailleurs',
  [LINE_FUNCTIONS.THEME_CARRIER]: 'Porteur thématique — incarne une question du récit'
});

/**
 * Coefficient de contribution à la tension globale selon le statut et la fonction.
 */
const TENSION_CONTRIBUTION = Object.freeze({
  [LINE_FUNCTIONS.TENSION]: { dormant: 0.0, emerging: 0.2, active: 0.6, climax: 1.0, resolving: 0.4, resolved: 0.0 },
  [LINE_FUNCTIONS.RELIEF]: { dormant: 0.0, emerging: -0.05, active: -0.15, climax: -0.1, resolving: -0.05, resolved: 0.0 },
  [LINE_FUNCTIONS.FORESHADOWING]: { dormant: 0.05, emerging: 0.1, active: 0.15, climax: 0.3, resolving: 0.1, resolved: 0.0 },
  [LINE_FUNCTIONS.RED_HERRING]: { dormant: 0.0, emerging: 0.1, active: 0.2, climax: 0.1, resolving: -0.1, resolved: -0.05 },
  [LINE_FUNCTIONS.CONNECTOR]: { dormant: 0.0, emerging: 0.05, active: 0.1, climax: 0.2, resolving: 0.05, resolved: 0.0 },
  [LINE_FUNCTIONS.CATALYST]: { dormant: 0.0, emerging: 0.15, active: 0.4, climax: 0.7, resolving: 0.2, resolved: 0.0 },
  [LINE_FUNCTIONS.THEME_CARRIER]: { dormant: 0.05, emerging: 0.1, active: 0.2, climax: 0.5, resolving: 0.15, resolved: 0.0 }
});

const LEVEL_TENSION_MULTIPLIER = Object.freeze({
  [LINE_LEVELS.MAJOR]: 1.0,
  [LINE_LEVELS.SECONDARY]: 0.5,
  [LINE_LEVELS.MICRO]: 0.2
});

const LINE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
  '#2980b9', '#8e44ad', '#27ae60', '#d35400', '#7f8c8d'
];

function createNarrativeLine(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name || '',
    description: data.description || '',
    status: data.status || LINE_STATUSES.DORMANT,
    level: data.level || LINE_LEVELS.MAJOR,
    narrativeFunction: data.narrativeFunction || LINE_FUNCTIONS.TENSION,
    weight: data.weight ?? 0.5,
    urgency: data.urgency ?? 0.0,
    lastAdvancedInUnit: data.lastAdvancedInUnit ?? -1,
    createdInUnit: data.createdInUnit ?? 0,
    agency: data.agency || 'reactive',
    projection: data.projection || [],
    dependencies: data.dependencies || [],
    tags: data.tags || [],
    color: data.color || LINE_COLORS[Math.floor(Math.random() * LINE_COLORS.length)],
    history: data.history || [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

export {
  LINE_STATUSES, STATUS_LABELS, STATUS_URGENCY_MULTIPLIER,
  LINE_LEVELS, LINE_LEVEL_LABELS,
  LINE_FUNCTIONS, LINE_FUNCTION_LABELS,
  TENSION_CONTRIBUTION, LEVEL_TENSION_MULTIPLIER,
  LINE_COLORS, createNarrativeLine
};
