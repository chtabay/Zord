import { STATUS_URGENCY_MULTIPLIER } from '../models/narrative-line.js';
import { DEFAULT_RULES } from '../models/narrative-rule.js';

class EvaluatorService {

  /**
   * Calcule l'urgence d'une ligne en fonction du temps écoulé depuis sa dernière progression,
   * de son poids et de son statut. Inspiré du système de tensions du projet lore.
   */
  calculateUrgency(line, currentUnitIndex) {
    if (line.status === 'resolved') return 0;

    const statusMultiplier = STATUS_URGENCY_MULTIPLIER[line.status] ?? 1.0;
    const gap = currentUnitIndex - Math.max(line.lastAdvancedInUnit, line.createdInUnit);

    // Croissance logarithmique de l'urgence (évite la saturation brutale)
    const timeDecay = 1 - Math.exp(-gap * 0.3);

    // Le poids amplifie l'urgence : une ligne importante négligée monte plus vite
    const weightFactor = 0.5 + line.weight * 0.5;

    const rawUrgency = timeDecay * statusMultiplier * weightFactor;
    return Math.min(0.95, Math.max(0, rawUrgency));
  }

  /**
   * Recalcule l'urgence de toutes les lignes
   */
  recalculateAllUrgencies(lines, currentUnitIndex) {
    for (const line of lines) {
      line.urgency = this.calculateUrgency(line, currentUnitIndex);
    }
    return lines;
  }

  /**
   * Génère un snapshot de pré-évaluation pour toutes les lignes actives
   */
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
        importance: this._calculateImportance(l, currentUnitIndex),
        notes: ''
      }))
      .sort((a, b) => b.importance - a.importance);

    const priorities = lineSnapshots.map(s => s.lineId);

    return {
      timestamp: new Date().toISOString(),
      lineSnapshots,
      priorities,
      globalNotes: ''
    };
  }

  /**
   * Score d'importance combinant poids, urgence et statut.
   * Ce score détermine l'ordre de priorité des lignes pour l'unité suivante.
   */
  _calculateImportance(line, currentUnitIndex) {
    const urgency = this.calculateUrgency(line, currentUnitIndex);
    // Pondération : 40% poids narratif, 40% urgence, 20% bonus de statut
    const statusBonus = line.status === 'climax' ? 0.2
      : line.status === 'resolving' ? 0.15
      : line.status === 'active' ? 0.1
      : 0;
    return line.weight * 0.4 + urgency * 0.4 + statusBonus;
  }

  /**
   * Prépare les données de post-évaluation en comparant l'état avant/après
   */
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
   * Évalue toutes les règles narratives actives
   */
  evaluateRules(lines, units, currentUnitIndex) {
    const allAlerts = [];
    for (const rule of DEFAULT_RULES) {
      if (!rule.active) continue;
      const alerts = rule.evaluate(lines, units, currentUnitIndex);
      allAlerts.push(...alerts);
    }
    return allAlerts.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Calcule des statistiques globales sur l'état narratif
   */
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

    return {
      totalLines: lines.length,
      activeCount: activeLines.length,
      resolvedCount: resolvedLines.length,
      totalUnits: units.length,
      completedUnits: units.filter(u => u.status === 'completed').length,
      statusDistribution,
      avgWeight,
      avgUrgency
    };
  }
}

const evaluator = new EvaluatorService();
export default evaluator;
