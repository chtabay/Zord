import storage from './services/storage.js';
import evaluator from './services/evaluator.js';
import { createNarrativeLine } from './models/narrative-line.js';
import { createStoryUnit, createPreEvaluation, createPostEvaluation, UNIT_STATUS } from './models/story-unit.js';
import {
  renderLineCard, renderLineForm, renderUnitCard, renderUnitForm,
  renderPreEvaluation, renderPostEvaluation, renderRuleAlerts,
  renderDashboard, renderStatusBadge, renderUrgencyBar
} from './ui/components.js';

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.modal = null;
    this._lineSnapshotForPost = null;
  }

  async init() {
    await storage.init();
    evaluator.setProject(storage.load());
    this._bindNavigation();
    this._bindGlobalActions();
    this.navigate('dashboard');
  }

  _syncEvaluator() {
    evaluator.setProject(storage.load());
  }

  // ── Navigation ──

  _bindNavigation() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.dataset.nav);
      });
    });
  }

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === view);
    });
    this._render();
  }

  _render() {
    this._syncEvaluator();
    const main = document.getElementById('main-content');
    switch (this.currentView) {
      case 'dashboard': return this._renderDashboard(main);
      case 'lines': return this._renderLines(main);
      case 'units': return this._renderUnits(main);
      case 'novel': return this._renderNovel(main);
      case 'rules': return this._renderRules(main);
      default: return this._renderDashboard(main);
    }
  }

  // ── Dashboard ──

  _renderDashboard(container) {
    const lines = storage.getLines();
    const units = storage.getUnits();
    const currentUnitIndex = units.length;

    evaluator.recalculateAllUrgencies(lines, currentUnitIndex);
    lines.forEach(l => storage.saveLine(l));

    const stats = evaluator.getStatistics(lines, units);
    const alerts = evaluator.evaluateRules(lines, units, currentUnitIndex);

    const topLines = [...lines]
      .filter(l => l.status !== 'resolved')
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);

    const topLinesHtml = topLines.length
      ? topLines.map(l => `
        <div class="top-line" style="border-left:3px solid ${l.color}">
          <span class="top-line-name">${l.name}</span>
          ${renderStatusBadge(l.status)}
          ${renderUrgencyBar(l.urgency, 'Urgence')}
        </div>`).join('')
      : '<p class="empty-state">Aucune ligne narrative créée</p>';

    container.innerHTML = `
      <div class="view-header">
        <h2>Tableau de bord</h2>
        <div class="project-name-area">
          <input type="text" id="project-name" class="project-name-input" value="${storage.getProjectName()}">
        </div>
      </div>
      ${renderDashboard(stats)}
      <div class="dashboard-grid">
        <div class="dashboard-section">
          <h3>Lignes les plus urgentes</h3>
          ${topLinesHtml}
        </div>
        <div class="dashboard-section">
          ${renderRuleAlerts(alerts)}
          ${!alerts.length ? '<h3>Alertes narratives</h3><p class="empty-state">Aucune alerte</p>' : ''}
        </div>
      </div>
    `;

    document.getElementById('project-name')?.addEventListener('change', (e) => {
      storage.saveProjectName(e.target.value);
    });
  }

  // ── Lignes narratives ──

  _renderLines(container) {
    const lines = storage.getLines();
    const units = storage.getUnits();
    evaluator.recalculateAllUrgencies(lines, units.length);

    const cardsHtml = lines.length
      ? lines.map(l => renderLineCard(l)).join('')
      : '<p class="empty-state">Aucune ligne narrative. Cliquez sur "Nouvelle ligne" pour commencer.</p>';

    container.innerHTML = `
      <div class="view-header">
        <h2>Lignes narratives</h2>
        <button class="btn btn-primary" data-action="new-line">+ Nouvelle ligne</button>
      </div>
      <div class="cards-grid">${cardsHtml}</div>
    `;

    this._bindLineActions(container);
  }

  _bindLineActions(container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'new-line': return this._showLineForm();
        case 'edit-line': return this._showLineForm(id);
        case 'delete-line': return this._deleteLine(id);
      }
    });
  }

  _showLineForm(lineId = null) {
    const lines = storage.getLines();
    const line = lineId ? lines.find(l => l.id === lineId) : null;
    this._openModal(line ? 'Modifier la ligne' : 'Nouvelle ligne', renderLineForm(line, lines));

    const form = document.getElementById('line-form');

    // Poids slider
    const weightInput = form.querySelector('[name="weight"]');
    const weightDisplay = form.querySelector('.weight-display');
    weightInput?.addEventListener('input', () => {
      weightDisplay.textContent = parseFloat(weightInput.value).toFixed(2);
    });

    // Couleur
    form.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        form.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        form.querySelector('[name="color"]').value = opt.dataset.color;
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const units = storage.getUnits();
      const deps = [...form.querySelectorAll('.dep-option input:checked')].map(cb => cb.value);
      const tags = fd.get('tags').split(',').map(t => t.trim()).filter(Boolean);

      const data = {
        id: fd.get('id') || undefined,
        name: fd.get('name'),
        description: fd.get('description'),
        status: fd.get('status'),
        weight: parseFloat(fd.get('weight')),
        color: fd.get('color'),
        tags,
        dependencies: deps,
        createdInUnit: line?.createdInUnit ?? units.length,
        lastAdvancedInUnit: line?.lastAdvancedInUnit ?? -1,
        urgency: line?.urgency ?? 0,
        history: line?.history || []
      };

      const savedLine = createNarrativeLine(data);
      if (line) {
        savedLine.createdAt = line.createdAt;
      }
      storage.saveLine(savedLine);
      this._closeModal();
      this._render();
    });
  }

  _deleteLine(id) {
    if (!confirm('Supprimer cette ligne narrative ?')) return;
    storage.deleteLine(id);
    this._render();
  }

  // ── Unités narratives ──

  _renderUnits(container) {
    const units = storage.getUnits();
    const lines = storage.getLines();

    const sorted = [...units].sort((a, b) => a.number - b.number);
    const cardsHtml = sorted.length
      ? sorted.map(u => renderUnitCard(u, lines)).join('')
      : '<p class="empty-state">Aucune unité narrative. Cliquez sur "Nouvelle unité" pour commencer.</p>';

    container.innerHTML = `
      <div class="view-header">
        <h2>Unités narratives</h2>
        <button class="btn btn-primary" data-action="new-unit">+ Nouvelle unité</button>
      </div>
      <div class="units-list">${cardsHtml}</div>
    `;

    this._bindUnitActions(container);
  }

  _bindUnitActions(container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'new-unit': return this._showUnitForm();
        case 'edit-unit': return this._showUnitForm(id);
        case 'delete-unit': return this._deleteUnit(id);
        case 'pre-eval': return this._showPreEvaluation(id);
        case 'post-eval': return this._showPostEvaluation(id);
        case 'view-eval': return this._showEvaluations(id);
      }
    });
  }

  _showUnitForm(unitId = null) {
    const units = storage.getUnits();
    const unit = unitId ? units.find(u => u.id === unitId) : null;
    const nextNumber = unit?.number ?? (units.length > 0 ? Math.max(...units.map(u => u.number)) + 1 : 1);

    const formUnit = unit || { number: nextNumber };
    this._openModal(unit ? 'Modifier l\'unité' : 'Nouvelle unité', renderUnitForm(formUnit));

    const form = document.getElementById('unit-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        id: fd.get('id') || undefined,
        type: fd.get('type'),
        number: parseInt(fd.get('number')),
        title: fd.get('title'),
        status: fd.get('status'),
        summary: fd.get('summary'),
        preEvaluation: unit?.preEvaluation || null,
        postEvaluation: unit?.postEvaluation || null,
        advancedLines: unit?.advancedLines || [],
        content: unit?.content || ''
      };

      const savedUnit = createStoryUnit(data);
      if (unit) {
        savedUnit.createdAt = unit.createdAt;
      }
      storage.saveUnit(savedUnit);
      this._closeModal();
      this._render();
    });
  }

  _deleteUnit(id) {
    if (!confirm('Supprimer cette unité narrative ?')) return;
    storage.deleteUnit(id);
    this._render();
  }

  // ── Pré-évaluation ──

  _showPreEvaluation(unitId) {
    const units = storage.getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const lines = storage.getLines();
    const unitIndex = units.indexOf(unit);
    const preEval = evaluator.generatePreEvaluation(lines, unitIndex);

    // Sauvegarde le snapshot pour la post-évaluation
    this._lineSnapshotForPost = JSON.parse(JSON.stringify(lines));

    const linesCheckboxes = lines
      .filter(l => l.status !== 'resolved')
      .map(l => `
        <label class="line-checkbox" style="border-left:3px solid ${l.color}">
          <input type="checkbox" name="advanced" value="${l.id}"> ${l.name}
          ${renderStatusBadge(l.status)}
          ${renderUrgencyBar(l.urgency, 'Urgence')}
        </label>
      `).join('');

    this._openModal('Pré-évaluation — ' + (unit.title || `Unité ${unit.number}`), `
      ${renderPreEvaluation(preEval, lines)}
      <hr>
      <form id="pre-eval-form">
        <div class="form-group">
          <label>Notes globales pour cette unité</label>
          <textarea name="globalNotes" rows="3" placeholder="Objectifs, contraintes, idées...">${preEval.globalNotes}</textarea>
        </div>
        <div class="form-group">
          <label>Lignes à faire progresser dans cette unité</label>
          <div class="lines-checklist">${linesCheckboxes}</div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Valider et passer en écriture</button>
          <button type="button" class="btn btn-secondary" data-action="cancel-form">Annuler</button>
        </div>
      </form>
    `);

    const form = document.getElementById('pre-eval-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      preEval.globalNotes = fd.get('globalNotes');
      unit.preEvaluation = preEval;
      unit.advancedLines = fd.getAll('advanced');
      unit.status = UNIT_STATUS.WRITING;
      storage.saveUnit(unit);
      this._closeModal();
      this._render();
    });
  }

  // ── Post-évaluation ──

  _showPostEvaluation(unitId) {
    const units = storage.getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const lines = storage.getLines();
    const unitIndex = units.indexOf(unit);

    const linesBefore = this._lineSnapshotForPost || (unit.preEvaluation
      ? unit.preEvaluation.lineSnapshots.map(s => ({ ...s, id: s.lineId }))
      : JSON.parse(JSON.stringify(lines)));

    const linesEditHtml = lines
      .filter(l => l.status !== 'resolved')
      .map(l => {
        const advanced = unit.advancedLines.includes(l.id);
        return `
          <div class="post-line-edit" style="border-left:3px solid ${l.color}">
            <div class="post-line-header">
              <span class="line-name">${l.name}</span>
              <label><input type="checkbox" name="advanced-${l.id}" ${advanced ? 'checked' : ''}> Avancée</label>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Statut</label>
                <select name="status-${l.id}">
                  <option value="dormant" ${l.status === 'dormant' ? 'selected' : ''}>Dormante</option>
                  <option value="emerging" ${l.status === 'emerging' ? 'selected' : ''}>Émergente</option>
                  <option value="active" ${l.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="climax" ${l.status === 'climax' ? 'selected' : ''}>Climax</option>
                  <option value="resolving" ${l.status === 'resolving' ? 'selected' : ''}>En résolution</option>
                  <option value="resolved" ${l.status === 'resolved' ? 'selected' : ''}>Résolue</option>
                </select>
              </div>
              <div class="form-group">
                <label>Poids <span class="weight-display">${l.weight.toFixed(2)}</span></label>
                <input type="range" name="weight-${l.id}" min="0" max="1" step="0.05" value="${l.weight}">
              </div>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <input type="text" name="notes-${l.id}" placeholder="Ce qui s'est passé pour cette ligne...">
            </div>
          </div>`;
      }).join('');

    this._openModal('Post-évaluation — ' + (unit.title || `Unité ${unit.number}`), `
      <form id="post-eval-form">
        <div class="form-group">
          <label>Texte du chapitre</label>
          <textarea name="content" rows="10" class="novel-textarea" placeholder="Collez le texte écrit pour ce chapitre...">${unit.content || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Résumé de l'unité</label>
          <textarea name="summary" rows="3" placeholder="Que s'est-il passé ?">${unit.summary || ''}</textarea>
        </div>
        <h3>Bilan par ligne</h3>
        <div class="post-lines-list">${linesEditHtml}</div>
        <div class="form-group">
          <label>Notes narratives</label>
          <textarea name="narrativeNotes" rows="3" placeholder="Observations, leçons, ajustements..."></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Valider et terminer</button>
          <button type="button" class="btn btn-secondary" data-action="cancel-form">Annuler</button>
        </div>
      </form>
    `);

    // Sliders live update
    const form = document.getElementById('post-eval-form');
    form.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', () => {
        slider.closest('.form-group').querySelector('.weight-display').textContent =
          parseFloat(slider.value).toFixed(2);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const advancedIds = [];

      for (const line of lines) {
        const wasAdvanced = fd.get(`advanced-${line.id}`) === 'on';
        const newStatus = fd.get(`status-${line.id}`) || line.status;
        const newWeight = parseFloat(fd.get(`weight-${line.id}`)) ?? line.weight;

        if (wasAdvanced) {
          advancedIds.push(line.id);
          line.lastAdvancedInUnit = unitIndex;
          line.history.push({
            unitId: unit.id,
            unitNumber: unit.number,
            note: fd.get(`notes-${line.id}`) || '',
            weightBefore: line.weight,
            weightAfter: newWeight,
            statusBefore: line.status,
            statusAfter: newStatus
          });
        }

        line.status = newStatus;
        line.weight = newWeight;
        storage.saveLine(line);
      }

      const postEval = evaluator.generatePostEvaluation(
        linesBefore, lines, advancedIds, unitIndex
      );
      postEval.narrativeNotes = fd.get('narrativeNotes');

      unit.postEvaluation = postEval;
      unit.advancedLines = advancedIds;
      unit.content = fd.get('content') || unit.content;
      unit.summary = fd.get('summary') || unit.summary;
      unit.status = UNIT_STATUS.COMPLETED;
      storage.saveUnit(unit);

      this._lineSnapshotForPost = null;
      this._closeModal();
      this._render();
    });
  }

  // ── Voir les évaluations ──

  _showEvaluations(unitId) {
    const units = storage.getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const lines = storage.getLines();
    this._openModal('Évaluations — ' + (unit.title || `Unité ${unit.number}`), `
      ${renderPreEvaluation(unit.preEvaluation, lines)}
      <hr>
      ${renderPostEvaluation(unit.postEvaluation, lines)}
    `);
  }

  // ── Roman ──

  _renderNovel(container) {
    const units = storage.getUnits();
    const lines = storage.getLines();
    const completedUnits = [...units]
      .filter(u => u.status === 'completed' || u.content)
      .sort((a, b) => a.number - b.number);

    const wordCount = completedUnits.reduce((sum, u) => {
      return sum + (u.content ? u.content.split(/\s+/).filter(Boolean).length : 0);
    }, 0);

    const chaptersHtml = completedUnits.length
      ? completedUnits.map(u => {
        const hasContent = u.content && u.content.trim();
        const advancedNames = u.advancedLines
          .map(id => lines.find(l => l.id === id))
          .filter(Boolean);
        const linesDots = advancedNames
          .map(l => `<span class="novel-line-dot" style="background:${l.color}" title="${l.name}"></span>`)
          .join('');

        const idx = completedUnits.indexOf(u);
        const prevUnit = idx > 0 ? completedUnits[idx - 1] : null;
        const nextUnit = idx < completedUnits.length - 1 ? completedUnits[idx + 1] : null;
        const navHtml = `
          <div class="novel-chapter-nav">
            ${prevUnit ? `<a href="#novel-ch-${prevUnit.number}" class="novel-nav-link novel-nav-prev" data-action="goto-chapter" data-chapter="${prevUnit.number}">← Ch.${prevUnit.number}</a>` : '<span></span>'}
            <a href="#novel-toc" class="novel-nav-link novel-nav-toc" data-action="goto-toc">↑ Sommaire</a>
            ${nextUnit ? `<a href="#novel-ch-${nextUnit.number}" class="novel-nav-link novel-nav-next" data-action="goto-chapter" data-chapter="${nextUnit.number}">Ch.${nextUnit.number} →</a>` : '<span></span>'}
          </div>`;

        return `
          <div class="novel-chapter" data-id="${u.id}" id="novel-ch-${u.number}">
            <div class="novel-chapter-header">
              <div class="novel-chapter-title-area">
                <h3>${u.type === 'chapter' ? 'Chapitre' : u.type} ${u.number}${u.title ? ` — ${u.title}` : ''}</h3>
                <div class="novel-chapter-meta">
                  ${linesDots}
                  ${hasContent ? `<span class="novel-word-count">${u.content.split(/\s+/).filter(Boolean).length} mots</span>` : ''}
                </div>
              </div>
              <div class="novel-chapter-actions">
                <button class="btn btn-sm btn-edit" data-action="edit-content" data-id="${u.id}">${hasContent ? 'Modifier' : 'Ajouter le texte'}</button>
              </div>
            </div>
            ${hasContent
              ? `<div class="novel-text">${this._formatNovelText(u.content)}</div>${navHtml}`
              : `<p class="empty-state">Aucun texte — <a href="#" data-action="edit-content" data-id="${u.id}">ajouter le contenu du chapitre</a></p>`
            }
          </div>`;
      }).join('')
      : '<p class="empty-state">Aucun chapitre terminé. Complétez des unités pour construire le roman.</p>';

    const tocHtml = completedUnits.length > 1
      ? `<nav class="novel-toc">
          <h3>Table des matières</h3>
          <ol class="novel-toc-list">
            ${completedUnits.map(u => `
              <li>
                <a href="#novel-ch-${u.number}" class="novel-toc-link" data-action="goto-chapter" data-chapter="${u.number}">
                  <span class="novel-toc-number">Ch.${u.number}</span>
                  <span class="novel-toc-title">${u.title || ''}</span>
                  <span class="novel-toc-words">${u.content ? u.content.split(/\\s+/).filter(Boolean).length : 0}</span>
                </a>
              </li>
            `).join('')}
          </ol>
        </nav>`
      : '';

    container.innerHTML = `
      <div class="view-header">
        <h2>Roman</h2>
        <div class="novel-stats">
          <span class="novel-stat">${completedUnits.length} chapitre${completedUnits.length > 1 ? 's' : ''}</span>
          <span class="novel-stat">${wordCount.toLocaleString('fr-FR')} mots</span>
          <button class="btn btn-sm" data-action="export-novel">Exporter le texte</button>
        </div>
      </div>
      ${tocHtml}
      <div class="novel-content">${chaptersHtml}</div>
    `;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      if (btn.dataset.action === 'edit-content') {
        this._showChapterContent(btn.dataset.id);
      }
      if (btn.dataset.action === 'export-novel') {
        this._exportNovel();
      }
      if (btn.dataset.action === 'goto-chapter') {
        const el = document.getElementById(`novel-ch-${btn.dataset.chapter}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (btn.dataset.action === 'goto-toc') {
        const toc = container.querySelector('.novel-toc');
        if (toc) toc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  _formatNovelText(text) {
    return text
      .split('\n\n')
      .map(para => para.trim())
      .filter(Boolean)
      .map(para => {
        if (para.startsWith('—') || para.startsWith('-')) {
          return `<p class="novel-dialogue">${para}</p>`;
        }
        return `<p>${para}</p>`;
      })
      .join('');
  }

  _showChapterContent(unitId) {
    const units = storage.getUnits();
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    this._openModal(`Texte — ${unit.title || `Chapitre ${unit.number}`}`, `
      <form id="content-form">
        <div class="form-group">
          <label>Contenu du chapitre</label>
          <textarea name="content" rows="20" class="novel-textarea" placeholder="Collez ou écrivez le texte du chapitre ici...">${unit.content || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Enregistrer</button>
          <button type="button" class="btn btn-secondary" data-action="cancel-form">Annuler</button>
        </div>
      </form>
    `);

    const form = document.getElementById('content-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      unit.content = fd.get('content');
      storage.saveUnit(unit);
      this._closeModal();
      this._render();
    });
  }

  _exportNovel() {
    const units = storage.getUnits();
    const sorted = [...units]
      .filter(u => u.content)
      .sort((a, b) => a.number - b.number);

    const text = sorted.map(u => {
      const heading = `${'#'.repeat(u.type === 'scene' ? 3 : 2)} ${u.type === 'chapter' ? 'Chapitre' : u.type} ${u.number}${u.title ? ` — ${u.title}` : ''}`;
      return `${heading}\n\n${u.content}`;
    }).join('\n\n---\n\n');

    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${storage.getProjectName().replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Règles ──

  _renderRules(container) {
    const lines = storage.getLines();
    const units = storage.getUnits();
    const alerts = evaluator.evaluateRules(lines, units, units.length);

    container.innerHTML = `
      <div class="view-header">
        <h2>Règles narratives</h2>
      </div>
      ${renderRuleAlerts(alerts)}
      ${!alerts.length ? '<p class="empty-state">Aucune alerte déclenchée. Toutes les règles sont respectées.</p>' : ''}
      <div class="rules-info">
        <h3>Règles actives</h3>
        <ul class="rules-list">
          <li><strong>Ligne négligée</strong> — Avertit si une ligne active n'a pas progressé depuis 3 unités</li>
          <li><strong>Déséquilibre des poids</strong> — Signale un écart de poids trop important entre les lignes</li>
          <li><strong>Surcharge narrative</strong> — Avertit si plus de 5 lignes sont actives simultanément</li>
          <li><strong>Convergence de climax</strong> — Signale les opportunités quand plusieurs lignes sont en climax</li>
          <li><strong>Pression de résolution</strong> — Signale les lignes ouvertes depuis longtemps sans résolution</li>
        </ul>
      </div>
    `;
  }

  // ── Actions globales ──

  _bindGlobalActions() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      switch (btn.dataset.action) {
        case 'cancel-form': return this._closeModal();
        case 'export-project': return this._exportProject();
        case 'import-project': return document.getElementById('import-file')?.click();
      }
    });

    document.getElementById('import-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          storage.importProject(reader.result);
          this._render();
        } catch (err) {
          alert('Erreur d\'import : ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  _exportProject() {
    const json = storage.exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zord-${storage.getProjectName().replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Modal ──

  _openModal(title, content) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    overlay.classList.add('open');
    document.body.classList.add('modal-open');
  }

  _closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('open');
    document.body.classList.remove('modal-open');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
