import { DEFAULT_PERSONAS } from '../models/persona.js';
import {
  LINE_LEVEL_LABELS, LINE_FUNCTION_LABELS,
  TENSION_CONTRIBUTION, LEVEL_TENSION_MULTIPLIER
} from '../models/narrative-line.js';
import { ACT_LABELS, TURNING_POINT_LABELS, TENSION_TYPE_LABELS } from '../models/dramatic-structure.js';

/**
 * Service d'évaluation par persona.
 *
 * Deux modes :
 * 1. Programmatique — évalue les critères du persona contre l'état du récit
 *    et produit un avis structuré (objet JSON).
 * 2. Prompt — génère un prompt complet pour invocation LLM en injectant
 *    l'état du récit dans le template du persona.
 *
 * Les deux modes produisent le même format de sortie : un objet PersonaEvaluation.
 */
class PersonaEvaluatorService {

  getPersona(id) {
    return DEFAULT_PERSONAS.find(p => p.id === id);
  }

  getAllPersonas() {
    return DEFAULT_PERSONAS;
  }

  /**
   * Évaluation programmatique : applique les critères du persona à l'état du récit.
   */
  evaluate(personaId, project) {
    const persona = this.getPersona(personaId);
    if (!persona) return null;

    const lines = project.narrativeLines || [];
    const units = project.storyUnits || [];
    const completedUnits = units.filter(u => u.status === 'completed');
    const currentUnitIndex = units.length;

    const criteriaResults = [];
    for (const criterion of persona.criteria) {
      const result = this._evaluateCriterion(criterion, persona, project, lines, completedUnits, currentUnitIndex);
      criteriaResults.push(result);
    }

    const overallScore = criteriaResults.length > 0
      ? criteriaResults.reduce((sum, r) => sum + r.score * r.weight, 0) /
        criteriaResults.reduce((sum, r) => sum + r.weight, 0)
      : 0;

    return {
      personaId: persona.id,
      personaName: persona.name,
      role: persona.role,
      timestamp: new Date().toISOString(),
      overallScore,
      criteria: criteriaResults,
      summary: this._generateSummary(persona, criteriaResults, overallScore)
    };
  }

  _evaluateCriterion(criterion, persona, project, lines, completedUnits, currentUnitIndex) {
    const result = {
      id: criterion.id,
      name: criterion.name,
      weight: criterion.weight,
      score: 0.5,
      observations: [],
      suggestions: []
    };

    switch (criterion.id) {
      case 'pacing':
        return this._evalPacing(result, lines, project);
      case 'subversion-timing':
        return this._evalSubversionTiming(result, lines, completedUnits, project);
      case 'arc-completeness':
        return this._evalArcCompleteness(result, lines, currentUnitIndex);
      case 'micro-hooks':
        return this._evalMicroHooks(result, lines);
      case 'show-dont-tell':
        return this._evalShowDontTell(result, lines, project);
      case 'ambiguity':
        return this._evalAmbiguity(result, lines);
      case 'dignity':
        return this._evalDignity(result, lines);
      case 'page-turner':
        return this._evalPageTurner(result, completedUnits);
      case 'character-attachment':
        return this._evalCharacterAttachment(result, lines, completedUnits);
      case 'serial-momentum':
        return this._evalSerialMomentum(result, completedUnits, lines);
      case 'revelation-economy':
        return this._evalRevelationEconomy(result, project);
      case 'cast-management':
        return this._evalCastManagement(result, lines, currentUnitIndex);
      case 'act-awareness':
        return this._evalActAwareness(result, lines, project, currentUnitIndex);
      default:
        result.observations.push('Critère non évalué programmatiquement — nécessite invocation LLM.');
        return result;
    }
  }

  _evalPacing(result, lines, project) {
    const reliefCount = lines.filter(l => l.narrativeFunction === 'relief' && l.status !== 'resolved').length;
    const tensionCount = lines.filter(l => l.narrativeFunction === 'tension' && (l.status === 'active' || l.status === 'climax')).length;

    if (tensionCount > 0 && reliefCount === 0) {
      result.score = 0.3;
      result.observations.push(`${tensionCount} lignes de tension actives, aucune ligne de respiration.`);
      result.suggestions.push('Créer une sous-intrigue de respiration (humour, relation, exploration du monde).');
    } else if (reliefCount > 0 && tensionCount > 0) {
      result.score = 0.8;
      result.observations.push('Équilibre tension/respiration correct.');
    } else {
      result.score = 0.5;
    }
    return result;
  }

  _evalSubversionTiming(result, lines, completedUnits, project) {
    if (!project?.dramaticStructure || project.dramaticStructure.currentAct !== 'setup') {
      result.score = 0.5;
      return result;
    }

    const negativeHeroes = lines.filter(l =>
      (l.tags || []).some(t => ['satire', 'corrompu', 'toxique'].includes(t.toLowerCase())) &&
      l.status !== 'dormant'
    );
    const hasPositiveHeroMoment = completedUnits.some(u =>
      (u.summary || '').toLowerCase().includes('héroï') ||
      (u.summary || '').toLowerCase().includes('sauve')
    );

    if (negativeHeroes.length > 0 && !hasPositiveHeroMoment) {
      result.score = 0.2;
      result.observations.push('Les "héros" sont révélés négatifs sans que le lecteur ait eu un moment d\'adhésion.');
      result.suggestions.push('Ajouter une scène où les Biomen sont authentiquement héroïques avant de montrer leur toxicité.');
    } else {
      result.score = 0.7;
    }
    return result;
  }

  _evalArcCompleteness(result, lines, currentUnitIndex) {
    const stagnant = lines.filter(l => {
      if (l.status === 'resolved' || l.status === 'dormant') return false;
      return (currentUnitIndex - l.lastAdvancedInUnit) >= 3;
    });

    if (stagnant.length > 0) {
      result.score = Math.max(0.1, 0.8 - stagnant.length * 0.15);
      result.observations.push(`${stagnant.length} ligne(s) stagnante(s) : ${stagnant.map(l => l.name).join(', ')}.`);
    } else {
      result.score = 0.9;
      result.observations.push('Toutes les lignes actives progressent.');
    }
    return result;
  }

  _evalMicroHooks(result, lines) {
    const microLines = lines.filter(l => l.level === 'micro' && l.status !== 'resolved');
    const activeLines = lines.filter(l => l.status !== 'resolved' && l.status !== 'dormant');

    if (microLines.length === 0 && activeLines.length >= 3) {
      result.score = 0.2;
      result.observations.push('Aucune micro-accroche. Le récit repose uniquement sur les arcs majeurs.');
      result.suggestions.push('Planter un détail intrigant, un objet récurrent, ou une question sans réponse.');
    } else if (microLines.length > 0) {
      result.score = 0.8;
      result.observations.push(`${microLines.length} micro-accroche(s) active(s).`);
    }
    return result;
  }

  _evalShowDontTell(result, lines, project) {
    const themeCarriers = lines.filter(l => l.narrativeFunction === 'theme_carrier');
    const passiveCarriers = themeCarriers.filter(l => l.agency === 'passive');

    if (passiveCarriers.length > 0) {
      result.score = 0.4;
      result.observations.push(`${passiveCarriers.length} porteur(s) thématique(s) passif(s) : le thème risque d'être dit plutôt que montré.`);
      result.suggestions.push('Donner de l\'agentivité aux lignes porteuses de thème — elles doivent AGIR le thème, pas le subir.');
    } else {
      result.score = 0.8;
    }
    return result;
  }

  _evalAmbiguity(result, lines) {
    const factions = {};
    for (const line of lines) {
      for (const tag of (line.tags || [])) {
        if (!factions[tag]) factions[tag] = { positive: 0, negative: 0, total: 0 };
        factions[tag].total++;
        const isNeg = (line.tags || []).some(t => ['satire', 'corrompu', 'toxique', 'antagoniste'].includes(t));
        if (isNeg) factions[tag].negative++;
        else factions[tag].positive++;
      }
    }

    const unbalanced = Object.entries(factions)
      .filter(([, v]) => v.total >= 2 && (v.negative === v.total || v.positive === v.total));

    if (unbalanced.length > 0) {
      result.score = 0.3;
      result.observations.push(`Factions uniformes : ${unbalanced.map(([k]) => k).join(', ')}. Pas d'ambiguïté morale.`);
      result.suggestions.push('Montrer un moment de doute, de faiblesse ou de bonté inattendue dans le camp "négatif".');
    } else {
      result.score = 0.8;
    }
    return result;
  }

  _evalDignity(result, lines) {
    const marginalizedLines = lines.filter(l =>
      (l.tags || []).some(t => ['pivot moral', 'marginalisé', 'souffre-douleur'].includes(t.toLowerCase()))
    );
    const passiveMarginal = marginalizedLines.filter(l => l.agency === 'passive');

    if (passiveMarginal.length > 0) {
      result.score = 0.3;
      result.observations.push(`${passiveMarginal.length} personnage(s) marginalisé(s) passif(s). Risque de réduction à la souffrance.`);
      result.suggestions.push('Le personnage doit CHOISIR, pas seulement ENDURER. Lui donner une décision qui a des conséquences.');
    } else if (marginalizedLines.length > 0) {
      result.score = 0.9;
    }
    return result;
  }

  _evalPageTurner(result, completedUnits) {
    if (completedUnits.length === 0) return result;
    const lastUnit = completedUnits[completedUnits.length - 1];
    const content = lastUnit.content || '';
    const lastParagraph = content.split('\n\n').filter(Boolean).pop() || '';

    const hasOpenQuestion = lastParagraph.includes('?') ||
      lastParagraph.toLowerCase().includes('quelque part') ||
      lastParagraph.toLowerCase().includes('soudain') ||
      lastParagraph.toLowerCase().includes('mais');

    result.score = hasOpenQuestion ? 0.8 : 0.4;
    result.observations.push(hasOpenQuestion
      ? 'Le dernier chapitre se termine sur une ouverture.'
      : 'Le dernier chapitre se termine de façon fermée. Risque de perte de momentum.');
    return result;
  }

  _evalCharacterAttachment(result, lines, completedUnits) {
    const withHistory = lines.filter(l => (l.history || []).length >= 2);
    if (withHistory.length > 0) {
      result.score = 0.7;
      result.observations.push(`${withHistory.length} personnage(s)/ligne(s) avec un historique développé.`);
    } else {
      result.score = 0.4;
      result.observations.push('Peu de lignes ont un historique riche. L\'attachement est limité.');
    }
    return result;
  }

  _evalSerialMomentum(result, completedUnits, lines) {
    if (completedUnits.length === 0) return result;
    const lastUnit = completedUnits[completedUnits.length - 1];
    const advancedMajor = (lastUnit.advancedLines || [])
      .map(id => lines.find(l => l.id === id))
      .filter(l => l && l.level === 'major').length;
    const hasForeshadowing = (lastUnit.advancedLines || [])
      .map(id => lines.find(l => l.id === id))
      .some(l => l && l.narrativeFunction === 'foreshadowing');

    if (advancedMajor >= 1 && hasForeshadowing) {
      result.score = 0.9;
      result.observations.push('Le dernier chapitre avance un arc majeur ET plante une graine.');
    } else if (advancedMajor >= 1) {
      result.score = 0.6;
      result.observations.push('Arc majeur avancé, mais pas d\'amorçage pour la suite.');
      result.suggestions.push('Glisser un élément de foreshadowing dans le prochain chapitre.');
    } else {
      result.score = 0.3;
      result.observations.push('Aucun arc majeur n\'a progressé dans le dernier chapitre.');
    }
    return result;
  }

  _evalRevelationEconomy(result, project) {
    const tps = project?.dramaticStructure?.turningPoints || [];
    const reached = tps.filter(tp => tp.reached).length;
    const total = tps.length;
    const units = (project?.storyUnits || []).filter(u => u.status === 'completed').length;
    const planned = project?.dramaticStructure?.totalPlannedUnits || 12;

    const progressRatio = units / planned;
    const revelationRatio = reached / total;

    if (revelationRatio > progressRatio + 0.2) {
      result.score = 0.3;
      result.observations.push('Trop de turning points atteints pour ce stade du récit. Les révélations sont trop rapides.');
    } else if (revelationRatio < progressRatio - 0.3) {
      result.score = 0.4;
      result.observations.push('Le récit avance mais les turning points ne sont pas atteints. Le lecteur attend du mouvement.');
    } else {
      result.score = 0.7;
      result.observations.push('Rythme des révélations cohérent avec la progression.');
    }
    return result;
  }

  _evalCastManagement(result, lines, currentUnitIndex) {
    const absent = lines.filter(l => {
      if (l.status === 'resolved' || l.status === 'dormant') return false;
      return (currentUnitIndex - Math.max(l.lastAdvancedInUnit, l.createdInUnit)) >= 2;
    });

    if (absent.length > 0) {
      result.score = Math.max(0.2, 0.8 - absent.length * 0.1);
      result.observations.push(`${absent.length} ligne(s) absente(s) depuis 2+ chapitres : ${absent.map(l => l.name).join(', ')}.`);
      result.suggestions.push('Faire tourner le casting — mentionner ou réactiver ces lignes.');
    } else {
      result.score = 0.9;
    }
    return result;
  }

  _evalActAwareness(result, lines, project, currentUnitIndex) {
    if (!project?.dramaticStructure) { result.score = 0.5; return result; }
    const ds = project.dramaticStructure;
    const planned = ds.totalPlannedUnits || 12;
    const act = ds.currentAct;

    const climaxLines = lines.filter(l => l.status === 'climax').length;
    if (act === 'setup' && climaxLines > 0) {
      result.score = 0.2;
      result.observations.push(`${climaxLines} ligne(s) en climax pendant l'Acte I. C'est trop tôt.`);
      result.suggestions.push('Réserver les climax pour l\'Acte II ou III.');
    } else if (act === 'setup' && currentUnitIndex <= Math.round(planned * 0.25)) {
      result.score = 0.8;
      result.observations.push('Position cohérente avec l\'Acte I.');
    } else if (act === 'setup' && currentUnitIndex > Math.round(planned * 0.3)) {
      result.score = 0.4;
      result.observations.push('L\'Acte I s\'éternise. Envisager l\'incident déclencheur.');
    } else {
      result.score = 0.6;
    }
    return result;
  }

  _generateSummary(persona, criteriaResults, overallScore) {
    const weakest = [...criteriaResults].sort((a, b) => a.score - b.score).slice(0, 2);
    const strongest = [...criteriaResults].sort((a, b) => b.score - a.score).slice(0, 2);

    const label = overallScore > 0.7 ? 'Solide'
      : overallScore > 0.5 ? 'Correct avec réserves'
      : overallScore > 0.3 ? 'Fragile'
      : 'Problématique';

    return {
      label,
      strengths: strongest.filter(c => c.score >= 0.6).map(c => c.name),
      weaknesses: weakest.filter(c => c.score < 0.5).map(c => c.name),
      allSuggestions: criteriaResults.flatMap(c => c.suggestions)
    };
  }

  /**
   * Génère un prompt complet pour invocation LLM.
   * Injecte l'état du récit dans le template du persona.
   */
  generatePrompt(personaId, project) {
    const persona = this.getPersona(personaId);
    if (!persona || !persona.promptTemplate) return null;

    const state = this._serializeState(project);
    const content = this._serializeContent(project);
    const ds = this._serializeDramaticStructure(project);
    const refs = (persona.references || []).map(r => `- ${r}`).join('\n');

    return persona.promptTemplate
      .replace('{{references}}', refs)
      .replace('{{state}}', state)
      .replace('{{content}}', content)
      .replace('{{dramaticStructure}}', ds);
  }

  _serializeState(project) {
    const lines = project.narrativeLines || [];
    const units = project.storyUnits || [];

    const linesState = lines.map(l =>
      `- ${l.name} [${l.status}] poids=${l.weight} niveau=${LINE_LEVEL_LABELS[l.level] || l.level} fonction=${LINE_FUNCTION_LABELS[l.narrativeFunction] || l.narrativeFunction} agentivité=${l.agency || 'reactive'}`
    ).join('\n');

    const unitsState = units.map(u =>
      `- Ch.${u.number} "${u.title}" [${u.status}] — ${u.summary || 'pas de résumé'}`
    ).join('\n');

    const tensions = (project.lineTensions || []).filter(t => t.active).map(t => {
      const a = lines.find(l => l.id === t.lineA)?.name || t.lineA;
      const b = lines.find(l => l.id === t.lineB)?.name || t.lineB;
      return `- ${a} ↔ ${b} (${TENSION_TYPE_LABELS[t.type] || t.type}, force=${t.strength})`;
    }).join('\n');

    const themes = (project.thematicQuestions || []).map(tq =>
      `- "${tq.question}" — dernière contribution : ch.${(tq.contributions || []).slice(-1)[0]?.unitNumber ?? '?'}`
    ).join('\n');

    return `LIGNES NARRATIVES :\n${linesState}\n\nUNITÉS :\n${unitsState}\n\nTENSIONS :\n${tensions}\n\nQUESTIONS THÉMATIQUES :\n${themes}`;
  }

  _serializeContent(project) {
    const units = (project.storyUnits || [])
      .filter(u => u.content)
      .sort((a, b) => a.number - b.number);
    return units.map(u => `--- Chapitre ${u.number} : ${u.title} ---\n${u.content}`).join('\n\n');
  }

  _serializeDramaticStructure(project) {
    const ds = project.dramaticStructure;
    if (!ds) return 'Non définie';

    const act = ACT_LABELS[ds.currentAct] || ds.currentAct;
    const tps = (ds.turningPoints || []).map(tp =>
      `- ${TURNING_POINT_LABELS[tp.type] || tp.type}: ${tp.reached ? '✓' : '○'} ${tp.description || ''}`
    ).join('\n');

    return `Acte courant : ${act}\nUnités prévues : ${ds.totalPlannedUnits || '?'}\n\nTurning points :\n${tps}`;
  }
}

const personaEvaluator = new PersonaEvaluatorService();
export default personaEvaluator;
