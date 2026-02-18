import { ACT_LABELS } from './dramatic-structure.js';

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

/**
 * Règles structurelles (craft rules).
 * Évaluent la qualité narrative, pas juste la mécanique.
 * Reçoivent le projet complet (lines, units, project) pour accéder aux
 * thematicQuestions, dramaticStructure, lineTensions.
 */
const STRUCTURAL_RULES = [
  {
    id: 'premature-subversion',
    name: 'Subversion prématurée',
    description: 'Avertit si un camp est uniformément positif ou négatif trop tôt dans le récit — la subversion perd son effet si le lecteur n\'a jamais cru à la façade.',
    type: RULE_TYPES.CONSTRAINT,
    active: true,
    evaluate(lines, units, currentUnitIndex, project) {
      if (!project?.dramaticStructure) return [];
      if (project.dramaticStructure.currentAct !== 'setup') return [];

      const alerts = [];
      const tagGroups = {};
      for (const line of lines) {
        for (const tag of (line.tags || [])) {
          if (!tagGroups[tag]) tagGroups[tag] = [];
          tagGroups[tag].push(line);
        }
      }

      for (const [tag, groupLines] of Object.entries(tagGroups)) {
        if (groupLines.length < 2) continue;
        const activeInGroup = groupLines.filter(l => l.status !== 'dormant' && l.status !== 'resolved');
        if (activeInGroup.length < 2) continue;

        const allSameValence = activeInGroup.every(l => {
          const hasCriticalTag = (l.tags || []).some(t =>
            ['satire', 'critique', 'toxique', 'corrompu'].includes(t.toLowerCase())
          );
          return hasCriticalTag;
        });

        if (allSameValence && activeInGroup.length >= 2) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            message: `Le groupe "${tag}" est uniformément négatif dès l'Acte I. Le lecteur n'a pas eu le temps de croire à la façade.`,
            severity: 0.7
          });
        }
      }
      return alerts;
    }
  },
  {
    id: 'agency-deficit',
    name: 'Déficit d\'agentivité',
    description: 'Avertit si un personnage/ligne ne fait que subir sans jamais initier d\'action sur plusieurs chapitres.',
    type: RULE_TYPES.WARNING,
    active: true,
    threshold: 3,
    evaluate(lines, units, currentUnitIndex) {
      const alerts = [];
      for (const line of lines) {
        if (line.status === 'resolved' || line.status === 'dormant') continue;
        const agency = line.agency || 'reactive';
        const age = currentUnitIndex - line.createdInUnit;

        if (agency === 'passive' && age >= this.threshold) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            lineId: line.id,
            lineName: line.name,
            message: `"${line.name}" est passive depuis ${age} unités. Un personnage/ligne qui ne fait que subir perd sa fonction narrative.`,
            severity: Math.min(1, age / (this.threshold * 2))
          });
        }
      }
      return alerts;
    }
  },
  {
    id: 'thematic-drift',
    name: 'Dérive thématique',
    description: 'Avertit si une question thématique n\'a reçu aucune contribution depuis plusieurs chapitres.',
    type: RULE_TYPES.GUIDELINE,
    active: true,
    threshold: 3,
    evaluate(lines, units, currentUnitIndex, project) {
      if (!project?.thematicQuestions?.length) return [];
      const alerts = [];

      for (const tq of project.thematicQuestions) {
        const lastContribution = (tq.contributions || [])
          .filter(c => c.unitNumber != null)
          .sort((a, b) => b.unitNumber - a.unitNumber)[0];

        const gap = lastContribution
          ? currentUnitIndex - lastContribution.unitNumber
          : currentUnitIndex;

        if (gap >= this.threshold) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            message: `La question "${tq.question}" n'a pas été nourrie depuis ${gap} unités. Le sous-texte risque de se perdre.`,
            severity: Math.min(1, gap / (this.threshold * 2))
          });
        }
      }
      return alerts;
    }
  },
  {
    id: 'tension-stagnation',
    name: 'Tension stagnante',
    description: 'Avertit si une tension entre deux lignes est active mais qu\'aucune des deux n\'a progressé.',
    type: RULE_TYPES.WARNING,
    active: true,
    threshold: 2,
    evaluate(lines, units, currentUnitIndex, project) {
      if (!project?.lineTensions?.length) return [];
      const alerts = [];

      for (const tension of project.lineTensions) {
        if (!tension.active) continue;
        const lineA = lines.find(l => l.id === tension.lineA);
        const lineB = lines.find(l => l.id === tension.lineB);
        if (!lineA || !lineB) continue;

        const gapA = currentUnitIndex - Math.max(lineA.lastAdvancedInUnit, lineA.createdInUnit);
        const gapB = currentUnitIndex - Math.max(lineB.lastAdvancedInUnit, lineB.createdInUnit);

        if (gapA >= this.threshold && gapB >= this.threshold) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            message: `La tension "${lineA.name}" ↔ "${lineB.name}" (${tension.type}) stagne — aucune des deux lignes n'a progressé depuis ${Math.min(gapA, gapB)}+ unités.`,
            severity: Math.min(1, Math.min(gapA, gapB) / (this.threshold * 3))
          });
        }
      }
      return alerts;
    }
  },
  {
    id: 'pacing-act-duration',
    name: 'Rythme structurel',
    description: 'Avertit si un acte dure trop longtemps par rapport au nombre total prévu d\'unités.',
    type: RULE_TYPES.GUIDELINE,
    active: true,
    evaluate(lines, units, currentUnitIndex, project) {
      if (!project?.dramaticStructure?.totalPlannedUnits) return [];
      const ds = project.dramaticStructure;
      const total = ds.totalPlannedUnits;
      const alerts = [];

      const actLimits = {
        setup: total * 0.25,
        confrontation: total * 0.75,
        resolution: total
      };

      const limit = actLimits[ds.currentAct];
      if (limit && currentUnitIndex > limit) {
        alerts.push({
          ruleId: this.id,
          ruleName: this.name,
          type: this.type,
          message: `L'${ACT_LABELS[ds.currentAct] || ds.currentAct} dure depuis ${currentUnitIndex} unités (limite suggérée : ${Math.round(limit)}). Envisager de passer à l'acte suivant.`,
          severity: Math.min(1, (currentUnitIndex - limit) / (total * 0.1))
        });
      }
      return alerts;
    }
  },
  {
    id: 'perspective-lines-desync',
    name: 'Perspectives désynchronisées',
    description: 'Avertit si deux lignes de type "perspective" (même sujet, angles différents) sont trop décalées en progression.',
    type: RULE_TYPES.WARNING,
    active: true,
    evaluate(lines, units, currentUnitIndex, project) {
      if (!project?.lineTensions?.length) return [];
      const alerts = [];

      const perspectiveTensions = project.lineTensions.filter(
        t => t.active && t.type === 'perspective'
      );

      for (const tension of perspectiveTensions) {
        const lineA = lines.find(l => l.id === tension.lineA);
        const lineB = lines.find(l => l.id === tension.lineB);
        if (!lineA || !lineB) continue;

        const statusOrder = ['dormant', 'emerging', 'active', 'climax', 'resolving', 'resolved'];
        const diff = Math.abs(
          statusOrder.indexOf(lineA.status) - statusOrder.indexOf(lineB.status)
        );

        if (diff >= 3) {
          alerts.push({
            ruleId: this.id,
            ruleName: this.name,
            type: this.type,
            message: `"${lineA.name}" (${lineA.status}) et "${lineB.name}" (${lineB.status}) sont censées montrer le même sujet sous deux angles, mais sont très décalées.`,
            severity: diff / 5
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

export { RULE_TYPES, RULE_TYPE_LABELS, DEFAULT_RULES, STRUCTURAL_RULES, createNarrativeRule };
