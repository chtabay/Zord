const ACTS = Object.freeze({
  SETUP: 'setup',
  CONFRONTATION: 'confrontation',
  RESOLUTION: 'resolution'
});

const ACT_LABELS = Object.freeze({
  [ACTS.SETUP]: 'Acte I — Mise en place',
  [ACTS.CONFRONTATION]: 'Acte II — Confrontation',
  [ACTS.RESOLUTION]: 'Acte III — Résolution'
});

/**
 * Points de structure dans l'arc dramatique.
 * Chaque turning point marque une frontière entre deux phases narratives.
 */
const TURNING_POINTS = Object.freeze({
  INCITING_INCIDENT: 'inciting_incident',
  FIRST_PLOT_POINT: 'first_plot_point',
  MIDPOINT: 'midpoint',
  CRISIS: 'crisis',
  CLIMAX_POINT: 'climax_point',
  DENOUEMENT: 'denouement'
});

const TURNING_POINT_LABELS = Object.freeze({
  [TURNING_POINTS.INCITING_INCIDENT]: 'Incident déclencheur',
  [TURNING_POINTS.FIRST_PLOT_POINT]: 'Premier nœud dramatique',
  [TURNING_POINTS.MIDPOINT]: 'Point médian',
  [TURNING_POINTS.CRISIS]: 'Crise',
  [TURNING_POINTS.CLIMAX_POINT]: 'Climax',
  [TURNING_POINTS.DENOUEMENT]: 'Dénouement'
});

/**
 * Types de tension entre deux lignes narratives.
 */
const TENSION_TYPES = Object.freeze({
  SYMBIOTIC: 'symbiotic',
  CONTRADICTORY: 'contradictory',
  CATALYTIC: 'catalytic',
  PERSPECTIVE: 'perspective',
  THEMATIC_ECHO: 'thematic_echo'
});

const TENSION_TYPE_LABELS = Object.freeze({
  [TENSION_TYPES.SYMBIOTIC]: 'Symbiotique',
  [TENSION_TYPES.CONTRADICTORY]: 'Contradictoire',
  [TENSION_TYPES.CATALYTIC]: 'Catalytique',
  [TENSION_TYPES.PERSPECTIVE]: 'Même sujet, angle différent',
  [TENSION_TYPES.THEMATIC_ECHO]: 'Écho thématique'
});

const TENSION_TYPE_DESCRIPTIONS = Object.freeze({
  [TENSION_TYPES.SYMBIOTIC]: 'Les deux lignes se nourrissent mutuellement — avancer l\'une renforce l\'autre',
  [TENSION_TYPES.CONTRADICTORY]: 'Les deux lignes s\'opposent — avancer l\'une affaiblit ou complique l\'autre',
  [TENSION_TYPES.CATALYTIC]: 'Une ligne déclenche ou accélère l\'autre (relation asymétrique)',
  [TENSION_TYPES.PERSPECTIVE]: 'Les deux lignes sont le même sujet vu de deux angles (ex: guerre vue par chaque camp)',
  [TENSION_TYPES.THEMATIC_ECHO]: 'Les deux lignes illustrent le même thème par des situations différentes'
});

/**
 * Caractère d'agentivité d'un personnage ou d'une ligne.
 * Mesure si la ligne/le personnage AGIT ou SUBIT.
 */
const AGENCY_LEVELS = Object.freeze({
  PASSIVE: 'passive',
  REACTIVE: 'reactive',
  PROACTIVE: 'proactive'
});

const AGENCY_LABELS = Object.freeze({
  [AGENCY_LEVELS.PASSIVE]: 'Passif — subit les événements',
  [AGENCY_LEVELS.REACTIVE]: 'Réactif — répond aux événements',
  [AGENCY_LEVELS.PROACTIVE]: 'Proactif — initie les événements'
});

function createThematicQuestion(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    question: data.question || '',
    description: data.description || '',
    relatedLines: data.relatedLines || [],
    contributions: data.contributions || []
  };
}

function createTurningPoint(data = {}) {
  return {
    type: data.type || TURNING_POINTS.INCITING_INCIDENT,
    unitId: data.unitId || null,
    description: data.description || '',
    reached: data.reached ?? false
  };
}

function createDramaticStructure(data = {}) {
  return {
    totalPlannedUnits: data.totalPlannedUnits ?? null,
    currentAct: data.currentAct || ACTS.SETUP,
    turningPoints: data.turningPoints || Object.values(TURNING_POINTS).map(tp =>
      createTurningPoint({ type: tp })
    )
  };
}

function createLineTension(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    lineA: data.lineA || '',
    lineB: data.lineB || '',
    type: data.type || TENSION_TYPES.SYMBIOTIC,
    strength: data.strength ?? 0.5,
    description: data.description || '',
    active: data.active ?? true
  };
}

export {
  ACTS, ACT_LABELS,
  TURNING_POINTS, TURNING_POINT_LABELS,
  TENSION_TYPES, TENSION_TYPE_LABELS, TENSION_TYPE_DESCRIPTIONS,
  AGENCY_LEVELS, AGENCY_LABELS,
  createThematicQuestion, createTurningPoint, createDramaticStructure, createLineTension
};
