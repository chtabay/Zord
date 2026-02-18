const UNIT_TYPES = Object.freeze({
  CHAPTER: 'chapter',
  SCENE: 'scene',
  ACT: 'act',
  ARC: 'arc'
});

const UNIT_TYPE_LABELS = Object.freeze({
  [UNIT_TYPES.CHAPTER]: 'Chapitre',
  [UNIT_TYPES.SCENE]: 'Scène',
  [UNIT_TYPES.ACT]: 'Acte',
  [UNIT_TYPES.ARC]: 'Arc'
});

const UNIT_STATUS = Object.freeze({
  PLANNING: 'planning',
  WRITING: 'writing',
  COMPLETED: 'completed'
});

const UNIT_STATUS_LABELS = Object.freeze({
  [UNIT_STATUS.PLANNING]: 'Planification',
  [UNIT_STATUS.WRITING]: 'Écriture',
  [UNIT_STATUS.COMPLETED]: 'Terminé'
});

function createPreEvaluation(data = {}) {
  return {
    timestamp: data.timestamp || new Date().toISOString(),
    lineSnapshots: data.lineSnapshots || [],
    priorities: data.priorities || [],
    globalNotes: data.globalNotes || ''
  };
}

function createPostEvaluation(data = {}) {
  return {
    timestamp: data.timestamp || new Date().toISOString(),
    lineUpdates: data.lineUpdates || [],
    nextPriorities: data.nextPriorities || [],
    narrativeNotes: data.narrativeNotes || '',
    rulesTriggered: data.rulesTriggered || []
  };
}

function createStoryUnit(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    type: data.type || UNIT_TYPES.CHAPTER,
    number: data.number ?? 1,
    title: data.title || '',
    status: data.status || UNIT_STATUS.PLANNING,
    preEvaluation: data.preEvaluation || null,
    postEvaluation: data.postEvaluation || null,
    advancedLines: data.advancedLines || [],
    summary: data.summary || '',
    content: data.content || '',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

export {
  UNIT_TYPES, UNIT_TYPE_LABELS, UNIT_STATUS, UNIT_STATUS_LABELS,
  createPreEvaluation, createPostEvaluation, createStoryUnit
};
