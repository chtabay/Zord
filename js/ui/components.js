import { STATUS_LABELS, LINE_STATUSES, LINE_COLORS } from '../models/narrative-line.js';
import { UNIT_TYPE_LABELS, UNIT_STATUS_LABELS, UNIT_STATUS } from '../models/story-unit.js';
import { RULE_TYPE_LABELS } from '../models/narrative-rule.js';

export function renderUrgencyBar(value, label = '') {
  const percent = Math.round(value * 100);
  const hue = 120 - (value * 120); // vert → rouge
  return `
    <div class="urgency-bar" title="${label}: ${percent}%">
      <div class="urgency-fill" style="width:${percent}%;background:hsl(${hue},70%,45%)"></div>
      <span class="urgency-label">${percent}%</span>
    </div>`;
}

export function renderStatusBadge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABELS[status] || status}</span>`;
}

export function renderUnitStatusBadge(status) {
  return `<span class="badge badge-unit-${status}">${UNIT_STATUS_LABELS[status] || status}</span>`;
}

export function renderLineCard(line, { onEdit, onDelete, compact = false } = {}) {
  const urgencyBar = renderUrgencyBar(line.urgency, 'Urgence');
  const weightBar = renderUrgencyBar(line.weight, 'Poids');
  return `
    <div class="line-card" data-id="${line.id}" style="border-left: 4px solid ${line.color}">
      <div class="line-card-header">
        <h3 class="line-name">${line.name}</h3>
        ${renderStatusBadge(line.status)}
      </div>
      ${!compact ? `<p class="line-desc">${line.description || '<em>Pas de description</em>'}</p>` : ''}
      <div class="line-metrics">
        <div class="metric">
          <span class="metric-label">Poids</span>
          ${weightBar}
        </div>
        <div class="metric">
          <span class="metric-label">Urgence</span>
          ${urgencyBar}
        </div>
      </div>
      ${line.tags.length ? `<div class="line-tags">${line.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
      <div class="line-card-actions">
        <button class="btn btn-sm btn-edit" data-action="edit-line" data-id="${line.id}">Modifier</button>
        <button class="btn btn-sm btn-danger" data-action="delete-line" data-id="${line.id}">Supprimer</button>
      </div>
    </div>`;
}

export function renderLineForm(line = null, allLines = []) {
  const isEdit = !!line;
  const statusOptions = Object.entries(STATUS_LABELS)
    .map(([val, label]) => `<option value="${val}" ${line?.status === val ? 'selected' : ''}>${label}</option>`)
    .join('');

  const colorOptions = LINE_COLORS
    .map(c => `<span class="color-option ${line?.color === c ? 'selected' : ''}" data-color="${c}" style="background:${c}" tabindex="0"></span>`)
    .join('');

  const depOptions = allLines
    .filter(l => l.id !== line?.id)
    .map(l => `<label class="dep-option"><input type="checkbox" value="${l.id}" ${line?.dependencies?.includes(l.id) ? 'checked' : ''}> ${l.name}</label>`)
    .join('');

  return `
    <form id="line-form" class="form">
      <input type="hidden" name="id" value="${line?.id || ''}">
      <div class="form-group">
        <label>Nom</label>
        <input type="text" name="name" value="${line?.name || ''}" required placeholder="Nom de la ligne narrative">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea name="description" rows="3" placeholder="Description de la ligne...">${line?.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select name="status">${statusOptions}</select>
        </div>
        <div class="form-group">
          <label>Poids <span class="weight-display">${(line?.weight ?? 0.5).toFixed(2)}</span></label>
          <input type="range" name="weight" min="0" max="1" step="0.05" value="${line?.weight ?? 0.5}">
        </div>
      </div>
      <div class="form-group">
        <label>Couleur</label>
        <div class="color-picker">${colorOptions}</div>
        <input type="hidden" name="color" value="${line?.color || LINE_COLORS[0]}">
      </div>
      <div class="form-group">
        <label>Tags <small>(séparés par des virgules)</small></label>
        <input type="text" name="tags" value="${line?.tags?.join(', ') || ''}" placeholder="intrigue, personnage, monde...">
      </div>
      ${depOptions ? `
      <div class="form-group">
        <label>Lignes liées</label>
        <div class="dep-list">${depOptions}</div>
      </div>` : ''}
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-form">Annuler</button>
      </div>
    </form>`;
}

export function renderUnitCard(unit, lines) {
  const advancedNames = unit.advancedLines
    .map(id => lines.find(l => l.id === id))
    .filter(Boolean)
    .map(l => `<span class="tag" style="border-color:${l.color}">${l.name}</span>`)
    .join('');

  return `
    <div class="unit-card" data-id="${unit.id}">
      <div class="unit-card-header">
        <h3>${UNIT_TYPE_LABELS[unit.type]} ${unit.number}${unit.title ? ` — ${unit.title}` : ''}</h3>
        ${renderUnitStatusBadge(unit.status)}
      </div>
      ${unit.summary ? `<p class="unit-summary">${unit.summary}</p>` : ''}
      ${advancedNames ? `<div class="unit-advanced"><span class="label-small">Lignes avancées :</span> ${advancedNames}</div>` : ''}
      <div class="unit-eval-indicators">
        <span class="eval-indicator ${unit.preEvaluation ? 'done' : ''}" title="Pré-évaluation">PRÉ ${unit.preEvaluation ? '✓' : '○'}</span>
        <span class="eval-indicator ${unit.postEvaluation ? 'done' : ''}" title="Post-évaluation">POST ${unit.postEvaluation ? '✓' : '○'}</span>
      </div>
      <div class="unit-card-actions">
        ${unit.status === UNIT_STATUS.PLANNING ? `<button class="btn btn-sm btn-primary" data-action="pre-eval" data-id="${unit.id}">Pré-évaluation</button>` : ''}
        ${unit.status === UNIT_STATUS.WRITING ? `<button class="btn btn-sm btn-primary" data-action="post-eval" data-id="${unit.id}">Post-évaluation</button>` : ''}
        ${unit.status === UNIT_STATUS.COMPLETED ? `<button class="btn btn-sm" data-action="view-eval" data-id="${unit.id}">Voir évaluations</button>` : ''}
        <button class="btn btn-sm btn-edit" data-action="edit-unit" data-id="${unit.id}">Modifier</button>
        <button class="btn btn-sm btn-danger" data-action="delete-unit" data-id="${unit.id}">Supprimer</button>
      </div>
    </div>`;
}

export function renderUnitForm(unit = null) {
  const isEdit = !!unit;
  const typeOptions = Object.entries(UNIT_TYPE_LABELS)
    .map(([val, label]) => `<option value="${val}" ${unit?.type === val ? 'selected' : ''}>${label}</option>`)
    .join('');
  const statusOptions = Object.entries(UNIT_STATUS_LABELS)
    .map(([val, label]) => `<option value="${val}" ${unit?.status === val ? 'selected' : ''}>${label}</option>`)
    .join('');

  return `
    <form id="unit-form" class="form">
      <input type="hidden" name="id" value="${unit?.id || ''}">
      <div class="form-row">
        <div class="form-group">
          <label>Type</label>
          <select name="type">${typeOptions}</select>
        </div>
        <div class="form-group">
          <label>Numéro</label>
          <input type="number" name="number" value="${unit?.number ?? ''}" min="1" required>
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select name="status">${statusOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Titre</label>
        <input type="text" name="title" value="${unit?.title || ''}" placeholder="Titre de l'unité">
      </div>
      <div class="form-group">
        <label>Résumé</label>
        <textarea name="summary" rows="3" placeholder="Que se passe-t-il dans cette unité ?">${unit?.summary || ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Enregistrer' : 'Créer'}</button>
        <button type="button" class="btn btn-secondary" data-action="cancel-form">Annuler</button>
      </div>
    </form>`;
}

export function renderPreEvaluation(preEval, lines) {
  if (!preEval) return '<p class="empty-state">Pas de pré-évaluation</p>';

  const rows = preEval.lineSnapshots.map(snap => {
    const line = lines.find(l => l.id === snap.lineId);
    return `
      <tr>
        <td><span class="color-dot" style="background:${line?.color || '#888'}"></span> ${snap.name}</td>
        <td>${renderStatusBadge(snap.status)}</td>
        <td>${renderUrgencyBar(snap.weight, 'Poids')}</td>
        <td>${renderUrgencyBar(snap.urgency, 'Urgence')}</td>
        <td>${renderUrgencyBar(snap.importance, 'Importance')}</td>
      </tr>`;
  }).join('');

  return `
    <div class="evaluation-view">
      <h3>Pré-évaluation</h3>
      <p class="eval-timestamp">Réalisée le ${new Date(preEval.timestamp).toLocaleString('fr-FR')}</p>
      <table class="eval-table">
        <thead><tr><th>Ligne</th><th>Statut</th><th>Poids</th><th>Urgence</th><th>Importance</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${preEval.globalNotes ? `<div class="eval-notes"><strong>Notes :</strong> ${preEval.globalNotes}</div>` : ''}
    </div>`;
}

export function renderPostEvaluation(postEval, lines) {
  if (!postEval) return '<p class="empty-state">Pas de post-évaluation</p>';

  const rows = postEval.lineUpdates.map(upd => {
    const line = lines.find(l => l.id === upd.lineId);
    const weightDelta = upd.weightAfter - upd.weightBefore;
    const weightArrow = weightDelta > 0 ? '↑' : weightDelta < 0 ? '↓' : '=';
    return `
      <tr>
        <td><span class="color-dot" style="background:${line?.color || '#888'}"></span> ${upd.name}</td>
        <td>${upd.advanced ? '✓' : ''}</td>
        <td>${renderStatusBadge(upd.statusBefore)} → ${renderStatusBadge(upd.statusAfter)}</td>
        <td>${upd.weightBefore.toFixed(2)} ${weightArrow} ${upd.weightAfter.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const rulesHtml = postEval.rulesTriggered.length
    ? `<div class="rules-alerts"><h4>Règles déclenchées</h4><ul>${postEval.rulesTriggered.map(r => `<li>${r}</li>`).join('')}</ul></div>`
    : '';

  return `
    <div class="evaluation-view">
      <h3>Post-évaluation</h3>
      <p class="eval-timestamp">Réalisée le ${new Date(postEval.timestamp).toLocaleString('fr-FR')}</p>
      ${rows ? `
      <table class="eval-table">
        <thead><tr><th>Ligne</th><th>Avancée</th><th>Statut</th><th>Poids</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<p>Aucune modification</p>'}
      ${rulesHtml}
      ${postEval.narrativeNotes ? `<div class="eval-notes"><strong>Notes :</strong> ${postEval.narrativeNotes}</div>` : ''}
    </div>`;
}

export function renderRuleAlerts(alerts) {
  if (!alerts.length) return '';

  return `
    <div class="rules-panel">
      <h3>Alertes narratives</h3>
      ${alerts.map(a => `
        <div class="alert alert-${a.type}" style="opacity:${0.5 + a.severity * 0.5}">
          <span class="alert-type">${RULE_TYPE_LABELS[a.type] || a.type}</span>
          <span class="alert-message">${a.message}</span>
        </div>
      `).join('')}
    </div>`;
}

export function renderDashboard(stats) {
  const tensionPercent = Math.round((stats.globalTension || 0) * 100);
  const tensionHue = 120 - (stats.globalTension || 0) * 120;
  const tensionLabel = stats.globalTensionLabel || '—';
  const actLabel = stats.currentAct === 'setup' ? 'Acte I'
    : stats.currentAct === 'confrontation' ? 'Acte II'
    : stats.currentAct === 'resolution' ? 'Acte III' : '—';

  return `
    <div class="dashboard">
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-value">${stats.totalLines}</div>
          <div class="stat-label">Lignes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.activeCount}</div>
          <div class="stat-label">Actives</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.completedUnits}/${stats.totalUnits}</div>
          <div class="stat-label">Unités</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(stats.avgUrgency * 100).toFixed(0)}%</div>
          <div class="stat-label">Urgence moy.</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:hsl(${tensionHue},70%,55%)">${tensionPercent}%</div>
          <div class="stat-label">Tension — ${tensionLabel}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${actLabel}</div>
          <div class="stat-label">Structure</div>
        </div>
      </div>
    </div>`;
}
