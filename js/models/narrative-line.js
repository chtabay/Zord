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
    weight: data.weight ?? 0.5,
    urgency: data.urgency ?? 0.0,
    lastAdvancedInUnit: data.lastAdvancedInUnit ?? -1,
    createdInUnit: data.createdInUnit ?? 0,
    dependencies: data.dependencies || [],
    tags: data.tags || [],
    color: data.color || LINE_COLORS[Math.floor(Math.random() * LINE_COLORS.length)],
    history: data.history || [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

export { LINE_STATUSES, STATUS_LABELS, STATUS_URGENCY_MULTIPLIER, LINE_COLORS, createNarrativeLine };
