const RULE_TYPES = Object.freeze({
  WARNING: 'warning',
  CONSTRAINT: 'constraint',
  GUIDELINE: 'guideline'
});

const RULE_TYPE_LABELS = Object.freeze({
  [RULE_TYPES.WARNING]: 'Avertissement',
  [RULE_TYPES.CONSTRAINT]: 'Contrainte',
  [RULE_TYPES.GUIDELINE]: 'Recommandation'
});

const DEFAULT_RULES = [
  {
    id: 'neglect',
    name: 'Ligne négligée',
    description: 'Avertit si une ligne active n\'a pas progressé depuis N unités',
    type: RULE_TYPES.WARNING,
    active: true,
    threshold: 3,
    evaluate(lines, units, currentUnitIndex) {
      const alerts = [];
      for (const line of lines) {
        if (line.status === 'resolved' || line.status === 'dormant') continue;
        const gap = currentUnitIndex - line.lastAdvancedInUnit;
        if (gap >= this.threshold) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            lineId: line.id,
            lineName: line.name,
            message: `"${line.name}" n'a pas progressé depuis ${gap} unités`,
            severity: Math.min(1, gap / (this.threshold * 2))
          });
        }
      }
      return alerts;
    }
  },
  {
    id: 'weight-imbalance',
    name: 'Déséquilibre des poids',
    description: 'Avertit si la distribution des poids est trop concentrée',
    type: RULE_TYPES.GUIDELINE,
    active: true,
    evaluate(lines) {
      const activeLines = lines.filter(l => l.status !== 'resolved' && l.status !== 'dormant');
      if (activeLines.length < 2) return [];

      const weights = activeLines.map(l => l.weight);
      const max = Math.max(...weights);
      const min = Math.min(...weights);

      if (max - min > 0.6) {
        return [{
          ruleId: this.id,
          ruleName: this.name,
          type: this.type,
          message: `Écart de poids important (${min.toFixed(2)} → ${max.toFixed(2)}). Certaines lignes risquent d'être éclipsées.`,
          severity: (max - min) / 1.0
        }];
      }
      return [];
    }
  },
  {
    id: 'too-many-active',
    name: 'Surcharge narrative',
    description: 'Avertit si trop de lignes sont actives simultanément',
    type: RULE_TYPES.WARNING,
    active: true,
    threshold: 5,
    evaluate(lines) {
      const activeCount = lines.filter(l =>
        l.status === 'active' || l.status === 'climax'
      ).length;

      if (activeCount > this.threshold) {
        return [{
          ruleId: this.id,
          ruleName: this.name,
          type: this.type,
          message: `${activeCount} lignes actives simultanément. Le récit risque de perdre en clarté.`,
          severity: Math.min(1, activeCount / (this.threshold * 2))
        }];
      }
      return [];
    }
  },
  {
    id: 'climax-convergence',
    name: 'Convergence de climax',
    description: 'Signale quand plusieurs lignes approchent du climax en même temps',
    type: RULE_TYPES.GUIDELINE,
    active: true,
    evaluate(lines) {
      const climaxLines = lines.filter(l => l.status === 'climax');
      if (climaxLines.length >= 2) {
        const names = climaxLines.map(l => `"${l.name}"`).join(', ');
        return [{
          ruleId: this.id,
          ruleName: this.name,
          type: this.type,
          message: `${climaxLines.length} lignes en climax simultané (${names}). Opportunité de convergence narrative.`,
          severity: 0.5
        }];
      }
      return [];
    }
  },
  {
    id: 'unresolved-pressure',
    name: 'Pression de résolution',
    description: 'Signale les lignes ouvertes depuis longtemps sans progression vers une résolution',
    type: RULE_TYPES.CONSTRAINT,
    active: true,
    threshold: 10,
    evaluate(lines, units, currentUnitIndex) {
      const alerts = [];
      for (const line of lines) {
        if (line.status === 'resolved') continue;
        const age = currentUnitIndex - line.createdInUnit;
        if (age >= this.threshold && line.status !== 'resolving' && line.status !== 'climax') {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            lineId: line.id,
            lineName: line.name,
            message: `"${line.name}" est ouverte depuis ${age} unités sans approcher de résolution`,
            severity: Math.min(1, age / (this.threshold * 2))
          });
        }
      }
      return alerts;
    }
  }
];

function createNarrativeRule(data = {}) {
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name || '',
    description: data.description || '',
    type: data.type || RULE_TYPES.GUIDELINE,
    active: data.active ?? true,
    threshold: data.threshold,
    evaluate: data.evaluate || (() => [])
  };
}

export { RULE_TYPES, RULE_TYPE_LABELS, DEFAULT_RULES, createNarrativeRule };
