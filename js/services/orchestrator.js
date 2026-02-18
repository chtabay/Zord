import evaluator from './evaluator.js';
import { STATUS_LABELS } from '../models/narrative-line.js';

/**
 * Orchestrateur du protocole agent pour Zord.
 *
 * Principes (hérités de V1.0 / novel_generator) :
 * - L'orchestrateur CALCULE et SÉLECTIONNE, ne génère jamais de contenu.
 * - Chaque agent reçoit UNIQUEMENT son slice de données.
 * - Le rédacteur ne connait ni scores, ni structure, ni priorités.
 * - Les turning points ÉMERGENT, ils ne sont pas planifiés.
 *
 * Flux (v2 — avec vérificateur) :
 *   1. Orchestrateur → pré-évalue, sélectionne les lignes
 *   2. Agent Analyste → lignes + alertes + projections → contraintes (QUOI, pas COMMENT)
 *   3. Agent Scénariste → contraintes + descriptions → texte du chapitre
 *   4. Agent Critique → texte + lignes assignées → statuts + notes
 *   5. Agent Vérificateur → texte + TOUTES les lignes → détecte les avancements implicites
 *   6. Orchestrateur → applique les résultats, calcule les poids mécaniquement, itère
 */
class OrchestratorService {

  // ────────────────────────────────────────────────────────
  // ÉTAPE 1 : Sélection des lignes à traiter
  // ────────────────────────────────────────────────────────

  selectLines(project) {
    const lines = project.narrativeLines || [];
    const units = project.storyUnits || [];
    const currentUnitIndex = units.length;

    evaluator.setProject(project);
    const preEval = evaluator.generatePreEvaluation(lines, currentUnitIndex);
    const alerts = evaluator.evaluateRules(lines, units, currentUnitIndex);
    const tension = evaluator.calculateGlobalTension(lines);

    const activeSnapshots = preEval.lineSnapshots.filter(s => s.status !== 'resolved');
    const maxLines = Math.min(5, Math.max(3, activeSnapshots.length));
    const selected = activeSnapshots.slice(0, maxLines);

    const selectedLines = selected.map(snap => {
      const full = lines.find(l => l.id === snap.lineId);
      return {
        id: full.id,
        name: full.name,
        description: full.description,
        status: full.status,
        level: full.level,
        narrativeFunction: full.narrativeFunction,
        agency: full.agency,
        projection: full.projection || [],
        weight: full.weight,
        urgency: snap.urgency,
        importance: snap.importance,
        tags: full.tags,
        history: (full.history || []).slice(-3),
        dependencies: full.dependencies
      };
    });

    const relevantAlerts = alerts.filter(a =>
      !a.lineId || selected.some(s => s.lineId === a.lineId)
    );

    return {
      selectedLines,
      mechanicalContext: {
        currentUnitIndex,
        totalUnits: units.length,
        tension: { value: tension.value, label: tension.label },
        alerts: relevantAlerts,
        suggestions: tension.suggestions
      },
      preEval
    };
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 2 : Brief Analyste (QUOI, pas COMMENT)
  // ────────────────────────────────────────────────────────

  buildAnalystBrief(selectedLines, mechanicalContext, project) {
    const units = (project.storyUnits || [])
      .filter(u => u.status === 'completed')
      .sort((a, b) => b.number - a.number)
      .slice(0, 2);

    const previousSummaries = units.length
      ? units.map(u => `Ch.${u.number} "${u.title}" : ${u.summary}`).reverse().join('\n')
      : 'Aucun chapitre précédent.';

    const linesText = selectedLines.map(l => {
      const historyText = l.history.length
        ? l.history.map(h => `  - Ch.${h.unitNumber}: ${h.note}`).join('\n')
        : '  (aucun historique)';
      const projText = l.projection.length
        ? l.projection.map(p => `  → ${p}`).join('\n')
        : '  (aucune projection)';

      return [
        `■ ${l.name} [${STATUS_LABELS[l.status] || l.status}]`,
        `  ${l.description}`,
        `  Agentivité : ${l.agency}`,
        `  Projections possibles :`,
        projText,
        `  Historique récent :`,
        historyText
      ].join('\n');
    }).join('\n\n');

    const alertsText = mechanicalContext.alerts.length
      ? mechanicalContext.alerts.map(a => `- ${a.message}`).join('\n')
      : 'Aucune alerte.';

    return `Tu es l'Agent Analyste. Tu identifies ce que chaque ligne narrative NÉCESSITE à ce stade du récit.

RÈGLE ABSOLUE : tu produis des contraintes sur CE QUI doit se passer, jamais sur COMMENT le rédacteur doit l'écrire. Tu ne proposes pas de scènes, pas de dialogues, pas d'actions spécifiques. Tu dis : "cette ligne doit progresser", "ce personnage doit agir", "cette tension doit être nourrie". Le COMMENT appartient au rédacteur.

CHAPITRES PRÉCÉDENTS :
${previousSummaries}

LIGNES NARRATIVES À TRAITER :
${linesText}

ALERTES DU MOTEUR :
${alertsText}

TÂCHE :
Pour chaque ligne, produis :
1. BESOIN NARRATIF : ce que cette ligne nécessite à ce stade (progression, pause, inflexion, escalade)
2. PRIORITÉ : haute / moyenne / basse
3. AGENTIVITÉ REQUISE : le personnage doit-il agir / subir / observer ?
4. PROJECTION RETENUE : parmi les projections possibles, laquelle est la plus pertinente (ou aucune)

Produis aussi :
- CONTRAINTES GÉNÉRALES : nombre max de lignes en premier plan, nécessité de micro-événements

Format de sortie : JSON structuré.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 3 : Brief Scénariste (inchangé — isolation totale)
  // ────────────────────────────────────────────────────────

  buildWriterBrief(analystOutput, selectedLines, project) {
    const units = (project.storyUnits || [])
      .filter(u => u.status === 'completed')
      .sort((a, b) => b.number - a.number)
      .slice(0, 3);

    const chapterNumber = (project.storyUnits || []).length + 1;

    const previousSummaries = units.length
      ? units.map(u => `Ch.${u.number} "${u.title}" : ${u.summary}`).reverse().join('\n')
      : 'Premier chapitre.';

    const linesText = selectedLines.map(l =>
      `■ ${l.name} [${STATUS_LABELS[l.status] || l.status}]\n  ${l.description}`
    ).join('\n\n');

    const constraintsText = typeof analystOutput === 'string'
      ? analystOutput
      : JSON.stringify(analystOutput, null, 2);

    return `Tu es l'Agent Scénariste. Tu rédiges le chapitre ${chapterNumber} du roman.

RÉSUMÉS DES CHAPITRES PRÉCÉDENTS :
${previousSummaries}

LIGNES NARRATIVES ASSIGNÉES :
${linesText}

CONTRAINTES DE RÉDACTION (fournies par l'analyste) :
${constraintsText}

RÈGLES D'ÉCRITURE :
- Prose littéraire, pas de narration didactique
- Dialogues avec tirets (—)
- Montrer, pas expliquer
- Paragraphes séparés par des doubles sauts de ligne
- Environ 600-900 mots
- Ne pas conclure le chapitre de façon fermée

Tu ne connais PAS la suite du récit. Écris ce chapitre en répondant aux contraintes.
Texte seulement, pas de méta-commentaire.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 4 : Brief Critique (sans ajustement de poids)
  // ────────────────────────────────────────────────────────

  buildCriticBrief(chapterText, selectedLines, analystOutput) {
    const linesText = selectedLines.map(l =>
      `■ ${l.name} [${STATUS_LABELS[l.status] || l.status}] — agentivité: ${l.agency}\n  ${l.description}`
    ).join('\n\n');

    const constraintsText = typeof analystOutput === 'string'
      ? analystOutput
      : JSON.stringify(analystOutput, null, 2);

    return `Tu es l'Agent Critique. Tu évalues le chapitre produit et proposes des mises à jour de STATUT pour chaque ligne narrative.

IMPORTANT : tu ne proposes PAS d'ajustement de poids. Les poids sont calculés mécaniquement par le système. Tu évalues uniquement le STATUT et l'AGENTIVITÉ.

TEXTE DU CHAPITRE :
${chapterText}

LIGNES NARRATIVES ASSIGNÉES (état avant le chapitre) :
${linesText}

CONTRAINTES QUI AVAIENT ÉTÉ DONNÉES AU RÉDACTEUR :
${constraintsText}

TÂCHE :
Pour chaque ligne assignée, évalue :
1. AVANCÉE : la ligne a-t-elle progressé dans ce chapitre ? (oui/non)
2. NOUVEAU STATUT : dormante / émergente / active / climax / en résolution / résolue
3. AGENTIVITÉ OBSERVÉE : passive / reactive / proactive
4. NOTE : ce qui s'est passé pour cette ligne (factuel, 1-2 phrases)
5. PROJECTION MISE À JOUR : que pourrait-il se passer ensuite pour cette ligne ?

Évalue aussi :
- NOUVELLES LIGNES à créer ? (micro-accroches, sous-intrigues émergentes)
- INCOHÉRENCES avec les chapitres précédents ?
- RÉSUMÉ du chapitre (2-3 phrases)
- TITRE suggéré

Format de sortie : JSON structuré.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 5 : Brief Vérificateur (TOUTES les lignes)
  // ────────────────────────────────────────────────────────

  /**
   * Le vérificateur revoit le chapitre contre TOUTES les lignes du projet,
   * pas seulement les assignées. Il détecte les avancements implicites.
   */
  buildVerifierBrief(chapterText, project) {
    const allLines = (project.narrativeLines || [])
      .filter(l => l.status !== 'resolved');

    const linesText = allLines.map(l =>
      `■ ${l.name} [${STATUS_LABELS[l.status] || l.status}]\n  ${l.description}`
    ).join('\n\n');

    return `Tu es l'Agent Vérificateur. Tu relis le chapitre et identifies TOUTES les lignes narratives qui ont été touchées, même implicitement.

Certaines lignes n'étaient pas assignées au rédacteur mais peuvent avoir été avancées dans le texte (un personnage mentionné, un thème effleuré, une tension nourrie indirectement).

TEXTE DU CHAPITRE :
${chapterText}

TOUTES LES LIGNES NARRATIVES DU PROJET :
${linesText}

TÂCHE :
Pour chaque ligne, indique :
1. TOUCHÉE : oui / non
2. TYPE : directement avancée / mentionnée / effleurée thématiquement / absente
3. NOTE : ce qui dans le texte touche cette ligne (citation courte ou description)
4. CHANGEMENT DE STATUT NÉCESSAIRE : oui (lequel) / non

Sois exhaustif. Ne rate aucune ligne touchée même indirectement.
Format de sortie : JSON structuré.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 6 : Application des résultats (poids mécaniques)
  // ────────────────────────────────────────────────────────

  /**
   * Applique les résultats du critique ET du vérificateur.
   * Les poids sont calculés mécaniquement :
   * - Ligne avancée + changement de statut → +0.05
   * - Ligne avancée sans changement de statut → poids inchangé
   * - Ligne touchée implicitement (vérificateur) → lastAdvancedInUnit mis à jour, poids inchangé
   * - Ligne non touchée → poids inchangé (l'urgence montera naturellement au cycle suivant)
   */
  applyResults(criticOutput, verifierOutput, chapterText, project) {
    const units = project.storyUnits || [];
    const lines = project.narrativeLines || [];
    const chapterNumber = units.length + 1;
    const currentIndex = units.length;

    const advancedLineIds = [];

    // Appliquer les résultats du critique (lignes assignées)
    const lineUpdates = criticOutput.lineUpdates || criticOutput.lines || [];
    for (const update of lineUpdates) {
      const line = lines.find(l =>
        l.id === update.id || l.name === update.name || l.name === update.lineName
      );
      if (!line) continue;

      const weightBefore = line.weight;
      const statusBefore = line.status;
      const newStatus = update.newStatus || update.status || line.status;
      const statusChanged = newStatus !== line.status;

      line.status = newStatus;
      if (update.agency) line.agency = update.agency;
      if (update.newProjection) line.projection = update.newProjection;

      // Poids mécanique : +0.05 si le statut a changé, sinon inchangé
      if (statusChanged && update.advanced) {
        line.weight = Math.min(1.0, line.weight + 0.05);
      }

      if (update.advanced) {
        advancedLineIds.push(line.id);
        line.lastAdvancedInUnit = currentIndex;
        line.history.push({
          unitId: `unit-ch${chapterNumber}`,
          unitNumber: chapterNumber,
          note: update.note || '',
          weightBefore,
          weightAfter: line.weight,
          statusBefore,
          statusAfter: line.status
        });
      }

      line.updatedAt = new Date().toISOString();
    }

    // Appliquer les résultats du vérificateur (lignes non-assignées touchées)
    const verifierUpdates = verifierOutput?.lines || verifierOutput?.lineUpdates || [];
    for (const vUpdate of verifierUpdates) {
      if (!vUpdate.touched || vUpdate.type === 'absente') continue;

      const line = lines.find(l =>
        l.id === vUpdate.id || l.name === vUpdate.name || l.name === vUpdate.lineName
      );
      if (!line) continue;
      if (advancedLineIds.includes(line.id)) continue;

      if (vUpdate.type === 'directement avancée' || vUpdate.type === 'mentionnée') {
        line.lastAdvancedInUnit = currentIndex;
        if (vUpdate.newStatus && vUpdate.newStatus !== line.status) {
          const statusBefore = line.status;
          const weightBefore = line.weight;
          line.status = vUpdate.newStatus;
          line.weight = Math.min(1.0, line.weight + 0.05);
          line.history.push({
            unitId: `unit-ch${chapterNumber}`,
            unitNumber: chapterNumber,
            note: `[Vérificateur] ${vUpdate.note || ''}`,
            weightBefore,
            weightAfter: line.weight,
            statusBefore,
            statusAfter: line.status
          });
          advancedLineIds.push(line.id);
        }
        line.updatedAt = new Date().toISOString();
      }
    }

    // Nouvelles lignes
    if (criticOutput.newLines) {
      for (const newLine of criticOutput.newLines) {
        project.narrativeLines.push({
          id: `line-${newLine.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
          name: newLine.name,
          description: newLine.description || '',
          status: newLine.status || 'emerging',
          level: newLine.level || 'micro',
          narrativeFunction: newLine.narrativeFunction || 'connector',
          weight: 0.30,
          urgency: 0,
          lastAdvancedInUnit: currentIndex,
          createdInUnit: currentIndex,
          agency: newLine.agency || 'reactive',
          projection: newLine.projection || [],
          dependencies: newLine.dependencies || [],
          tags: newLine.tags || [],
          color: newLine.color || '#7f8c8d',
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Nouvelle unité
    const newUnit = {
      id: `unit-ch${chapterNumber}`,
      type: 'chapter',
      number: chapterNumber,
      title: criticOutput.suggestedTitle || criticOutput.title || `Chapitre ${chapterNumber}`,
      status: 'completed',
      content: chapterText,
      summary: criticOutput.summary || '',
      advancedLines: advancedLineIds,
      preEvaluation: null,
      postEvaluation: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    project.storyUnits.push(newUnit);
    project.updatedAt = new Date().toISOString();

    return project;
  }
}

const orchestrator = new OrchestratorService();
export default orchestrator;
