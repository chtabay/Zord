import {
  STATUS_URGENCY_MULTIPLIER,
  TENSION_CONTRIBUTION, LEVEL_TENSION_MULTIPLIER,
  LINE_FUNCTIONS, LINE_LEVELS
} from '../models/narrative-line.js';
import { DEFAULT_RULES, STRUCTURAL_RULES } from '../models/narrative-rule.js';

class EvaluatorService {

  calculateUrgency(line, currentUnitIndex) {
    if (line.status === 'resolved') return 0;

    const statusMultiplier = STATUS_URGENCY_MULTIPLIER[line.status] ?? 1.0;
    const gap = currentUnitIndex - Math.max(line.lastAdvancedInUnit, line.createdInUnit);
    const timeDecay = 1 - Math.exp(-gap * 0.3);
    const weightFactor = 0.5 + line.weight * 0.5;

    // Les tensions amplifient l'urgence : si une ligne liée par une tension a progressé,
    // la pression monte sur l'autre
    let tensionBoost = 0;
    if (this._currentProject?.lineTensions) {
      for (const tension of this._currentProject.lineTensions) {
        if (!tension.active) continue;
        const isA = tension.lineA === line.id;
        const isB = tension.lineB === line.id;
        if (!isA && !isB) continue;

        const otherId = isA ? tension.lineB : tension.lineA;
        const otherLine = this._currentProject.narrativeLines?.find(l => l.id === otherId);
        if (!otherLine) continue;

        const otherGap = currentUnitIndex - Math.max(otherLine.lastAdvancedInUnit, otherLine.createdInUnit);
        if (otherGap < gap) {
          tensionBoost += tension.strength * 0.15;
        }
      }
    }

    const rawUrgency = timeDecay * statusMultiplier * weightFactor + tensionBoost;
    return Math.min(0.95, Math.max(0, rawUrgency));
  }

  recalculateAllUrgencies(lines, currentUnitIndex) {
    for (const line of lines) {
      line.urgency = this.calculateUrgency(line, currentUnitIndex);
    }
    return lines;
  }

  /**
   * Injecte le projet complet pour que les calculs d'urgence et les règles
   * puissent accéder aux tensions, questions thématiques et structure dramatique.
   */
  setProject(project) {
    this._currentProject = project;
  }

  generatePreEvaluation(lines, currentUnitIndex) {
    const updatedLines = this.recalculateAllUrgencies([...lines], currentUnitIndex);

    const lineSnapshots = updatedLines
      .filter(l => l.status !== 'resolved')
      .map(l => ({
        lineId: l.id,
        name: l.name,
        weight: l.weight,
        urgency: l.urgency,
        status: l.status,
        agency: l.agency || 'reactive',
        importance: this._calculateImportance(l, currentUnitIndex),
        notes: ''
      }))
      .sort((a, b) => b.importance - a.importance);

    const priorities = lineSnapshots.map(s => s.lineId);

    // Contexte structurel pour le briefing
    const structuralContext = this._buildStructuralContext(lines, currentUnitIndex);

    return {
      timestamp: new Date().toISOString(),
      lineSnapshots,
      priorities,
      structuralContext,
      globalNotes: ''
    };
  }

  _calculateImportance(line, currentUnitIndex) {
    const urgency = this.calculateUrgency(line, currentUnitIndex);
    const statusBonus = line.status === 'climax' ? 0.2
      : line.status === 'resolving' ? 0.15
      : line.status === 'active' ? 0.1
      : 0;

    // Bonus thématique : les lignes liées à des questions thématiques en dérive gagnent en importance
    let thematicBonus = 0;
    if (this._currentProject?.thematicQuestions) {
      for (const tq of this._currentProject.thematicQuestions) {
        if ((tq.relatedLines || []).includes(line.id)) {
          const lastContrib = (tq.contributions || [])
            .filter(c => c.unitNumber != null)
            .sort((a, b) => b.unitNumber - a.unitNumber)[0];
          const gap = lastContrib ? currentUnitIndex - lastContrib.unitNumber : currentUnitIndex;
          if (gap >= 2) thematicBonus += 0.05;
        }
      }
    }

    return line.weight * 0.35 + urgency * 0.35 + statusBonus + Math.min(0.15, thematicBonus);
  }

  /**
   * Construit un contexte structurel lisible pour le briefing pré-évaluation.
   */
  _buildStructuralContext(lines, currentUnitIndex) {
    const ctx = {};
    const project = this._currentProject;
    if (!project) return ctx;

    if (project.dramaticStructure) {
      const ds = project.dramaticStructure;
      ctx.currentAct = ds.currentAct;
      ctx.totalPlannedUnits = ds.totalPlannedUnits;
      ctx.progress = ds.totalPlannedUnits
        ? Math.round((currentUnitIndex / ds.totalPlannedUnits) * 100)
        : null;

      const nextTP = (ds.turningPoints || []).find(tp => !tp.reached);
      ctx.nextTurningPoint = nextTP ? nextTP.type : null;
    }

    if (project.thematicQuestions?.length) {
      ctx.thematicQuestions = project.thematicQuestions.map(tq => ({
        question: tq.question,
        lastContribution: ((tq.contributions || [])
          .sort((a, b) => (b.unitNumber || 0) - (a.unitNumber || 0))[0])?.unitNumber ?? null
      }));
    }

    if (project.lineTensions?.length) {
      ctx.activeTensions = project.lineTensions
        .filter(t => t.active)
        .map(t => {
          const a = lines.find(l => l.id === t.lineA);
          const b = lines.find(l => l.id === t.lineB);
          return {
            lines: [a?.name, b?.name].filter(Boolean),
            type: t.type,
            strength: t.strength
          };
        });
    }

    return ctx;
  }

  generatePostEvaluation(linesBefore, linesAfter, advancedLineIds, currentUnitIndex) {
    const lineUpdates = [];

    for (const after of linesAfter) {
      const before = linesBefore.find(l => l.id === after.id);
      if (!before) continue;

      const hasChanged = before.weight !== after.weight
        || before.status !== after.status
        || advancedLineIds.includes(after.id);

      if (hasChanged) {
        lineUpdates.push({
          lineId: after.id,
          name: after.name,
          weightBefore: before.weight,
          weightAfter: after.weight,
          urgencyBefore: before.urgency,
          urgencyAfter: this.calculateUrgency(after, currentUnitIndex),
          statusBefore: before.status,
          statusAfter: after.status,
          advanced: advancedLineIds.includes(after.id),
          notes: ''
        });
      }
    }

    const nextUnitIndex = currentUnitIndex + 1;
    const updatedAfter = this.recalculateAllUrgencies([...linesAfter], nextUnitIndex);
    const nextPriorities = updatedAfter
      .filter(l => l.status !== 'resolved')
      .sort((a, b) =>
        this._calculateImportance(b, nextUnitIndex) - this._calculateImportance(a, nextUnitIndex)
      )
      .map(l => l.id);

    const rulesTriggered = this.evaluateRules(linesAfter, [], currentUnitIndex);

    return {
      timestamp: new Date().toISOString(),
      lineUpdates,
      nextPriorities,
      narrativeNotes: '',
      rulesTriggered: rulesTriggered.map(r => r.message)
    };
  }

  /**
   * Tensomètre global.
   * Calcule le niveau de tension narratif en agrégeant les contributions
   * de chaque ligne selon sa fonction, son statut et son niveau hiérarchique.
   * Retourne un objet { value, label, functionBreakdown, suggestions }.
   */
  calculateGlobalTension(lines) {
    const activeLines = lines.filter(l => l.status !== 'resolved');
    if (!activeLines.length) return { value: 0, label: 'Néant', functionBreakdown: {}, suggestions: [] };

    let totalContribution = 0;
    let maxPossible = 0;
    const functionBreakdown = {};

    for (const line of activeLines) {
      const fn = line.narrativeFunction || 'tension';
      const level = line.level || 'major';
      const contrib = TENSION_CONTRIBUTION[fn]?.[line.status] ?? 0.1;
      const levelMult = LEVEL_TENSION_MULTIPLIER[level] ?? 1.0;
      const weighted = contrib * levelMult * line.weight;

      totalContribution += weighted;
      maxPossible += 1.0 * levelMult * line.weight;

      if (!functionBreakdown[fn]) functionBreakdown[fn] = { count: 0, contribution: 0 };
      functionBreakdown[fn].count++;
      functionBreakdown[fn].contribution += weighted;
    }

    const value = maxPossible > 0 ? Math.max(0, Math.min(1, totalContribution / maxPossible)) : 0;

    const label = value > 0.75 ? 'Surchauffe'
      : value > 0.5 ? 'Haute tension'
      : value > 0.3 ? 'Tension modérée'
      : value > 0.1 ? 'Basse tension'
      : 'Atone';

    const suggestions = this._generateTensionSuggestions(value, activeLines, functionBreakdown);

    return { value, label, functionBreakdown, suggestions };
  }

  _generateTensionSuggestions(tensionValue, activeLines, breakdown) {
    const suggestions = [];

    const reliefCount = breakdown[LINE_FUNCTIONS.RELIEF]?.count || 0;
    const tensionCount = breakdown[LINE_FUNCTIONS.TENSION]?.count || 0;
    const foreshadowCount = breakdown[LINE_FUNCTIONS.FORESHADOWING]?.count || 0;
    const microCount = activeLines.filter(l => l.level === 'micro').length;

    if (tensionValue > 0.7 && reliefCount === 0) {
      suggestions.push({
        type: 'create',
        level: 'secondary',
        narrativeFunction: 'relief',
        message: 'Tension élevée sans ligne de respiration. Créer une sous-intrigue légère (humour, relation, worldbuilding) pour donner de l\'air au lecteur.'
      });
    }

    if (tensionValue > 0.8) {
      suggestions.push({
        type: 'create',
        level: 'micro',
        narrativeFunction: 'red_herring',
        message: 'Surchauffe narrative. Envisager un leurre ou une fausse piste pour détourner temporairement l\'attention et relancer la surprise plus tard.'
      });
    }

    if (tensionValue < 0.15 && activeLines.length > 2) {
      suggestions.push({
        type: 'create',
        level: 'micro',
        narrativeFunction: 'tension',
        message: 'Tension atone. Créer une micro-accroche de tension (menace, secret révélé, deadline) pour relancer l\'intérêt.'
      });
    }

    if (tensionValue < 0.25 && foreshadowCount === 0) {
      suggestions.push({
        type: 'create',
        level: 'micro',
        narrativeFunction: 'foreshadowing',
        message: 'Pas d\'amorçage actif. Planter une graine narrative (objet, phrase, détail) pour préparer un développement futur.'
      });
    }

    if (microCount === 0 && activeLines.length >= 3) {
      suggestions.push({
        type: 'create',
        level: 'micro',
        narrativeFunction: 'connector',
        message: 'Aucune micro-accroche. Les arcs majeurs avancent en parallèle sans liant. Créer un élément de connexion (personnage secondaire, lieu, objet) qui circule entre les lignes.'
      });
    }

    if (tensionValue > 0.5 && tensionValue < 0.7 && reliefCount > tensionCount) {
      suggestions.push({
        type: 'escalate',
        message: 'Plus de lignes de respiration que de tension. La pression narrative risque de retomber. Escalader une ligne existante ou en créer une nouvelle.'
      });
    }

    const allTension = activeLines.filter(l =>
      (l.narrativeFunction || 'tension') === 'tension' &&
      (l.status === 'active' || l.status === 'climax')
    );
    if (allTension.length >= 3 && allTension.every(l => l.level === 'major')) {
      suggestions.push({
        type: 'diversify',
        message: `${allTension.length} arcs majeurs en tension simultanée, tous au même niveau. Diversifier avec des sous-intrigues ou des micro-hooks pour moduler le rythme.`
      });
    }

    return suggestions;
  }

  /**
   * Évalue toutes les règles : mécaniques (DEFAULT) + structurelles (CRAFT).
   */
  evaluateRules(lines, units, currentUnitIndex) {
    const project = this._currentProject;
    const allAlerts = [];

    for (const rule of DEFAULT_RULES) {
      if (!rule.active) continue;
      const alerts = rule.evaluate(lines, units, currentUnitIndex, project);
      allAlerts.push(...alerts);
    }

    for (const rule of STRUCTURAL_RULES) {
      if (!rule.active) continue;
      const alerts = rule.evaluate(lines, units, currentUnitIndex, project);
      allAlerts.push(...alerts);
    }

    // Suggestions du tensomètre
    const tension = this.calculateGlobalTension(lines);
    for (const suggestion of tension.suggestions) {
      allAlerts.push({
        ruleId: 'tension-balance',
        ruleName: 'Équilibre de tension',
        type: suggestion.type === 'create' ? 'guideline' : 'warning',
        message: suggestion.message,
        severity: suggestion.type === 'create' ? 0.6 : 0.4,
        suggestion
      });
    }

    return allAlerts.sort((a, b) => b.severity - a.severity);
  }

  getStatistics(lines, units) {
    const activeLines = lines.filter(l => l.status !== 'resolved');
    const resolvedLines = lines.filter(l => l.status === 'resolved');

    const statusDistribution = {};
    for (const line of lines) {
      statusDistribution[line.status] = (statusDistribution[line.status] || 0) + 1;
    }

    const avgWeight = activeLines.length > 0
      ? activeLines.reduce((s, l) => s + l.weight, 0) / activeLines.length
      : 0;
    const avgUrgency = activeLines.length > 0
      ? activeLines.reduce((s, l) => s + l.urgency, 0) / activeLines.length
      : 0;

    const project = this._currentProject;
    const stats = {
      totalLines: lines.length,
      activeCount: activeLines.length,
      resolvedCount: resolvedLines.length,
      totalUnits: units.length,
      completedUnits: units.filter(u => u.status === 'completed').length,
      statusDistribution,
      avgWeight,
      avgUrgency
    };

    if (project?.dramaticStructure) {
      stats.currentAct = project.dramaticStructure.currentAct;
    }
    if (project?.thematicQuestions) {
      stats.thematicQuestions = project.thematicQuestions.length;
    }
    if (project?.lineTensions) {
      stats.activeTensions = project.lineTensions.filter(t => t.active).length;
    }

    const tension = this.calculateGlobalTension(lines);
    stats.globalTension = tension.value;
    stats.globalTensionLabel = tension.label;
    stats.tensionBreakdown = tension.functionBreakdown;

    return stats;
  }
}

const evaluator = new EvaluatorService();
export default evaluator;
