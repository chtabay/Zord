import evaluator from './evaluator.js';
import { STATUS_LABELS } from '../models/narrative-line.js';

/**
 * Orchestrateur v3 — Mémoire distribuée et experts interrogeables.
 *
 * Principes :
 * - Le contexte narratif vit dans des FICHIERS PAR ENTITÉ, pas dans les prompts.
 * - Chaque agent accède à ce dont il a besoin via queryExpert().
 * - L'orchestrateur coordonne sans porter le contexte — il connaît l'index, pas le contenu.
 * - Le scénariste reçoit de la MATIÈRE (personnages, lieux, style), pas des résumés.
 * - Les turning points ÉMERGENT, ils ne sont pas planifiés.
 *
 * Flux v3.1 :
 *   1. Orchestrateur → pré-évalue, sélectionne lignes, identifie entités
 *   2. queryExpert() × N → briefs personnages + lieux
 *   3. Agent Analyste → question dramatique + scènes (A/B/runner) + contraintes (QUOI)
 *   4. Agent Scénariste × N → une scène par appel, avec matière riche
 *   5. Agent Éditeur → assemble les scènes en chapitre (transitions, rythme, hook)
 *   6. Agent Critique → statuts + projections + notes personnages
 *   7. Agent Vérificateur → avancements implicites
 *   8. Orchestrateur → poids mécaniques + mise à jour des fichiers entités
 */
class OrchestratorService {

  // ────────────────────────────────────────────────────────
  // ÉTAPE 1 : Sélection et identification des entités
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

  /**
   * Identifie les personnages et lieux impliqués par les lignes sélectionnées.
   * Retourne les IDs à interroger via queryExpert.
   */
  identifyEntities(selectedLines, characterIndex, worldIndex) {
    const characterIds = new Set();
    const locationIds = new Set();

    const tagToChar = {
      'flagor': 'flagor', 'malak': 'malak', 'bamboule': 'soren',
      'soren': 'soren', 'biomen': null, 'kira': 'kira',
      'dorian': 'dorian', 'helena': 'helena', 'syra': 'syra'
    };
    const tagToLoc = {
      'lieu': 'astre-eteint', 'guerre': null, 'astre': 'astre-eteint',
      'haut-conseil': null, 'politique': null
    };

    for (const line of selectedLines) {
      for (const tag of (line.tags || [])) {
        const charId = tagToChar[tag.toLowerCase()];
        if (charId) characterIds.add(charId);
        const locId = tagToLoc[tag.toLowerCase()];
        if (locId) locationIds.add(locId);
      }
    }

    if (characterIds.size === 0) characterIds.add('flagor');
    if (locationIds.size === 0) locationIds.add('astre-eteint');

    return {
      characterIds: [...characterIds],
      locationIds: [...locationIds]
    };
  }

  // ────────────────────────────────────────────────────────
  // queryExpert — cœur du système distribué
  // ────────────────────────────────────────────────────────

  /**
   * Construit le prompt pour interroger un micro-expert.
   * L'appelant charge les données du fichier et passe entityData.
   *
   * @param {string} entityType - "characters" ou "world"
   * @param {Object} entityData - contenu du fichier JSON de l'entité
   * @param {string} question - la question posée à l'expert
   * @returns {string} prompt pour le micro-agent
   */
  buildExpertQuery(entityType, entityData, question) {
    const typeLabel = entityType === 'characters' ? 'personnage' : 'élément du monde';
    return `Tu es l'expert responsable du ${typeLabel} "${entityData.name}".

DONNÉES :
${JSON.stringify(entityData, null, 2)}

QUESTION :
${question}

Réponds factuellement, 2-5 phrases. Sois concret et spécifique. Cite des détails des données.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 2 : Brief Analyste (v3 — scènes + rôles A/B)
  // ────────────────────────────────────────────────────────

  buildAnalystBrief(selectedLines, mechanicalContext, project) {
    const units = (project.storyUnits || [])
      .filter(u => u.status === 'completed')
      .sort((a, b) => b.number - a.number)
      .slice(0, 2);

    const previousSummaries = units.length
      ? units.map(u => `Ch.${u.number} "${u.title}" : ${u.summary}`).reverse().join('\n')
      : 'Aucun chapitre précédent.';

    const lastTone = units.length
      ? this._assessChapterTone(units[0])
      : 'inconnu';

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

    return `Tu es l'Agent Analyste. Tu identifies ce que chaque ligne narrative NÉCESSITE et tu STRUCTURES le chapitre en scènes.

RÈGLE ABSOLUE : tu produis des contraintes sur CE QUI doit se passer, jamais sur COMMENT le rédacteur doit l'écrire.

CHAPITRES PRÉCÉDENTS :
${previousSummaries}

TON DU DERNIER CHAPITRE : ${lastTone}

LIGNES NARRATIVES SÉLECTIONNÉES :
${linesText}

ALERTES DU MOTEUR :
${alertsText}

TÂCHE EN 3 PARTIES :

PARTIE 1 — RÔLES STRUCTURELS
Assigne un rôle à chaque ligne pour CE chapitre :
- A-STORY : intrigue principale, traitement profond (1-2 lignes max)
- B-STORY : contrepoint thématique, éclairage différent (1 ligne)
- RUNNER : mention légère, pas de développement (0-2 lignes)
- ABSENT : délibérément pas dans ce chapitre (justifier)

PARTIE 2 — DÉCOUPE EN SCÈNES
Propose 2-3 scènes pour le chapitre :
Pour chaque scène :
- LIEU : où se passe la scène
- PERSONNAGES : qui est présent
- OBJECTIF : ce qui doit CHANGER dans cette scène (pas ce qui se passe — ce qui change)
- LIGNES CONCERNÉES : quelles lignes cette scène fait avancer

PARTIE 3 — CONTRAINTES PAR LIGNE
Pour chaque ligne non-absente :
- BESOIN NARRATIF
- AGENTIVITÉ REQUISE
- PROJECTION RETENUE

Format : JSON structuré.`;
  }

  _assessChapterTone(unit) {
    if (!unit || !unit.content) return 'inconnu';
    const content = unit.content.toLowerCase();
    const tensionWords = ['mort', 'sang', 'explosion', 'détruit', 'menace', 'peur', 'guerre', 'poings'];
    const reliefWords = ['beauté', 'silence', 'étoiles', 'lumière', 'marche', 'respir', 'calme'];
    const tensionScore = tensionWords.filter(w => content.includes(w)).length;
    const reliefScore = reliefWords.filter(w => content.includes(w)).length;
    if (tensionScore > reliefScore + 2) return 'haute tension — le prochain chapitre gagnerait à offrir un contraste';
    if (reliefScore > tensionScore + 2) return 'respiration — le prochain chapitre peut escalader';
    return 'équilibré';
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 3 : Brief Scénariste v3 (matière, pas résumés)
  // ────────────────────────────────────────────────────────

  /**
   * Construit le brief du scénariste avec la matière riche :
   * - Style guide (chargé depuis le fichier)
   * - Briefs personnages (réponses des micro-experts)
   * - Briefs lieux (réponses des micro-experts)
   * - Contraintes de l'analyste
   * - Derniers paragraphes du chapitre précédent (continuité de prose)
   *
   * Le scénariste NE reçoit PAS : résumés, scores, structure, turning points.
   */
  buildWriterBriefV3({
    chapterNumber,
    styleGuide,
    characterBriefs,
    locationBriefs,
    analystConstraints,
    lastParagraphs
  }) {
    const styleText = [
      `Voix : ${styleGuide.narrativeVoice?.person}, ${styleGuide.narrativeVoice?.focalization}`,
      `Temps : ${styleGuide.narrativeVoice?.tense}`,
      `Ton : ${styleGuide.tone?.register}`,
      `Dialogues : ${styleGuide.dialogueStyle?.marker}, ${styleGuide.dialogueStyle?.density}`,
      `Chapitre : ${styleGuide.chapterConventions?.length}, ${styleGuide.chapterConventions?.ending}`
    ].join('\n');

    const charsText = Object.entries(characterBriefs)
      .map(([id, brief]) => `■ ${id.toUpperCase()}\n${brief}`)
      .join('\n\n');

    const locsText = Object.entries(locationBriefs)
      .map(([id, brief]) => `■ ${id.toUpperCase()}\n${brief}`)
      .join('\n\n');

    const constraintsText = typeof analystConstraints === 'string'
      ? analystConstraints
      : JSON.stringify(analystConstraints, null, 2);

    return `Tu es l'Agent Scénariste. Tu rédiges le chapitre ${chapterNumber} du roman.

STYLE D'ÉCRITURE :
${styleText}

PERSONNAGES PRÉSENTS (fiches vivantes) :
${charsText}

LIEUX (palette sensorielle) :
${locsText}

CONTRAINTES NARRATIVES (fournies par l'analyste) :
${constraintsText}

CONTINUITÉ — derniers paragraphes du chapitre précédent :
${lastParagraphs}

Tu ne connais PAS la suite du récit. Écris ce chapitre en t'appuyant sur la matière ci-dessus.
Texte seulement, pas de méta-commentaire.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 4 : Brief Critique (+ notes personnages)
  // ────────────────────────────────────────────────────────

  buildCriticBrief(chapterText, selectedLines, analystOutput) {
    const linesText = selectedLines.map(l =>
      `■ ${l.name} [${STATUS_LABELS[l.status] || l.status}] — agentivité: ${l.agency}\n  ${l.description}`
    ).join('\n\n');

    const constraintsText = typeof analystOutput === 'string'
      ? analystOutput
      : JSON.stringify(analystOutput, null, 2);

    return `Tu es l'Agent Critique. Tu évalues le chapitre et proposes des mises à jour.

IMPORTANT : tu ne proposes PAS d'ajustement de poids (calculé mécaniquement).

TEXTE DU CHAPITRE :
${chapterText}

LIGNES ASSIGNÉES (état avant) :
${linesText}

CONTRAINTES DONNÉES AU RÉDACTEUR :
${constraintsText}

TÂCHE :
Pour chaque ligne :
1. AVANCÉE : oui/non
2. NOUVEAU STATUT
3. AGENTIVITÉ OBSERVÉE
4. NOTE (factuel)
5. PROJECTION MISE À JOUR

Pour chaque PERSONNAGE apparu dans le chapitre :
- Nouveau trait physique ou vocal observé ?
- Changement d'état émotionnel ?
- Nouvelle relation ou changement de relation ?
- Nouvelle localisation ?

+ NOUVELLES LIGNES, INCOHÉRENCES, RÉSUMÉ, TITRE
JSON structuré.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 5 : Brief Vérificateur (inchangé)
  // ────────────────────────────────────────────────────────

  buildVerifierBrief(chapterText, project) {
    const allLines = (project.narrativeLines || [])
      .filter(l => l.status !== 'resolved');

    const linesText = allLines.map(l =>
      `■ ${l.name} [${STATUS_LABELS[l.status] || l.status}]\n  ${l.description}`
    ).join('\n\n');

    return `Tu es l'Agent Vérificateur. Identifie TOUTES les lignes touchées, même implicitement.

TEXTE DU CHAPITRE :
${chapterText}

TOUTES LES LIGNES :
${linesText}

Pour chaque ligne :
1. TOUCHÉE : oui / non
2. TYPE : directement avancée / mentionnée / effleurée / absente
3. NOTE
4. CHANGEMENT DE STATUT NÉCESSAIRE

JSON structuré.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 6 : Agent Éditeur — assemblage des scènes en chapitre
  // ────────────────────────────────────────────────────────

  /**
   * L'éditeur reçoit les scènes brutes (produites individuellement) et les
   * assemble en un chapitre cohérent. Il ne RÉÉCRIT pas — il compose :
   * - Ouverture du chapitre (accroche)
   * - Transitions entre scènes (ruptures, ponts, blancs typographiques)
   * - Rythme (variation de la densité, souffle entre les tensions)
   * - Fermeture / hook de fin de chapitre
   *
   * C'est le travail d'un éditeur : couper, agencer, rythmer — pas réécrire.
   */
  buildEditorBrief({
    chapterNumber,
    dramaticQuestion,
    scenes,
    styleGuide,
    previousChapterEnding
  }) {
    const scenesText = scenes.map((s, i) =>
      `=== SCÈNE ${i + 1} : ${s.title || s.lieu || 'Sans titre'} ===\n${s.text}`
    ).join('\n\n');

    const styleText = [
      `Voix : ${styleGuide.narrativeVoice?.person}, ${styleGuide.narrativeVoice?.tense}`,
      `Chapitre : ${styleGuide.chapterConventions?.structure}`,
      `Fin : ${styleGuide.chapterConventions?.ending}`
    ].join('\n');

    return `Tu es l'Agent Éditeur. Tu assembles des scènes brutes en un chapitre cohérent.

Tu ne RÉÉCRIS PAS les scènes. Tu les COMPOSES :
- Ajouter une OUVERTURE si la première scène commence trop abruptement (1-3 phrases max)
- Insérer des TRANSITIONS entre les scènes (blancs typographiques, phrases de pont, ou coupures nettes — selon le rythme)
- Ajuster le RYTHME : si deux scènes ont le même tempo, varier (couper un passage qui répète, aérer un passage dense)
- Ajouter une FERMETURE / hook de fin de chapitre si la dernière scène ne se termine pas sur une ouverture
- Corriger les INCOHÉRENCES mineures entre scènes (un personnage qui change de lieu sans transition, un détail contradictoire)
- Supprimer les RÉPÉTITIONS entre scènes (même image, même formulation dans deux scènes différentes)

Tu peux COUPER des phrases ou des paragraphes. Tu peux AJOUTER des phrases de transition (5-10 mots max). Tu ne peux PAS réécrire des passages entiers.

CHAPITRE ${chapterNumber}
QUESTION DRAMATIQUE : ${dramaticQuestion}

STYLE :
${styleText}

FIN DU CHAPITRE PRÉCÉDENT :
${previousChapterEnding}

SCÈNES À ASSEMBLER :
${scenesText}

Produis le texte FINAL du chapitre — scènes assemblées, transitions en place, ouverture et fermeture. Texte seulement.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 7 : Brief Mise à jour des entités
  // ────────────────────────────────────────────────────────

  /**
   * Construit le prompt pour mettre à jour les fichiers d'entités
   * après un chapitre. L'agent reçoit le texte + les fiches actuelles
   * et produit les deltas à appliquer.
   */
  buildEntityUpdateBrief(chapterText, chapterNumber, characterFiles, worldFiles) {
    const charsText = Object.entries(characterFiles)
      .map(([id, data]) => `■ ${id}: currentState="${data.currentState}", location="${data.location}"`)
      .join('\n');

    const locsText = Object.entries(worldFiles)
      .map(([id, data]) => `■ ${id}: ${data.name}`)
      .join('\n');

    return `Tu es l'Agent de Mise à jour. Tu lis le chapitre et identifies les changements à appliquer aux fiches personnages et monde.

TEXTE DU CHAPITRE ${chapterNumber} :
${chapterText}

PERSONNAGES ACTUELS :
${charsText}

LIEUX ACTUELS :
${locsText}

TÂCHE :
Pour chaque personnage APPARU ou MENTIONNÉ dans le chapitre :
- currentState : nouvel état émotionnel/physique
- location : nouvelle localisation (si changée)
- relationships : relations changées (avec qui, comment)
- newVoiceExample : nouvelle réplique notable (si pertinent)

Pour chaque lieu UTILISÉ dans le chapitre :
- newEvent : "Ch.${chapterNumber}: ce qui s'est passé ici"
- newArea : nouvelle sous-zone mentionnée (si pertinent)
- newSensoryDetail : nouveau détail sensoriel (si pertinent)

Ne liste QUE les changements. Pas de répétition de l'existant.
JSON structuré.`;
  }

  // ────────────────────────────────────────────────────────
  // ÉTAPE 7 : Application des résultats (poids mécaniques)
  // ────────────────────────────────────────────────────────

  applyResults(criticOutput, verifierOutput, chapterText, project) {
    const units = project.storyUnits || [];
    const lines = project.narrativeLines || [];
    const chapterNumber = units.length + 1;
    const currentIndex = units.length;

    const advancedLineIds = [];

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

  /**
   * Extrait les derniers paragraphes du chapitre précédent
   * pour la continuité de prose du scénariste.
   */
  getLastParagraphs(project, count = 3) {
    const units = (project.storyUnits || [])
      .filter(u => u.status === 'completed' && u.content)
      .sort((a, b) => b.number - a.number);

    if (!units.length) return 'Premier chapitre — pas de continuité.';

    const lastContent = units[0].content;
    const paragraphs = lastContent.split('\n\n').filter(Boolean);
    return paragraphs.slice(-count).join('\n\n');
  }
}

const orchestrator = new OrchestratorService();
export default orchestrator;
