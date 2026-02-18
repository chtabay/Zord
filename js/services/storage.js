const STORAGE_KEY = 'zord_project';
const DATA_FILE = 'data/project.json';

class StorageService {
  constructor() {
    this._cache = null;
    this._ready = false;
    this._onReady = [];
  }

  _getDefaultProject() {
    return {
      name: 'Nouveau projet',
      narrativeLines: [],
      storyUnits: [],
      thematicQuestions: [],
      lineTensions: [],
      dramaticStructure: {
        totalPlannedUnits: null,
        currentAct: 'setup',
        turningPoints: [
          { type: 'inciting_incident', unitId: null, description: '', reached: false },
          { type: 'first_plot_point', unitId: null, description: '', reached: false },
          { type: 'midpoint', unitId: null, description: '', reached: false },
          { type: 'crisis', unitId: null, description: '', reached: false },
          { type: 'climax_point', unitId: null, description: '', reached: false },
          { type: 'denouement', unitId: null, description: '', reached: false }
        ]
      },
      settings: {
        neglectThreshold: 3,
        maxActiveLinesWarning: 5,
        resolutionPressureThreshold: 10
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Initialise le storage :
   * 1. Tente de charger data/project.json (source de vérité du repo)
   * 2. Si le fichier est plus récent que le localStorage, il le remplace
   * 3. Sinon, utilise le localStorage existant
   */
  async init() {
    const local = this._loadLocal();
    let remote = null;

    try {
      const res = await fetch(DATA_FILE);
      if (res.ok) {
        remote = await res.json();
      }
    } catch {
      // Pas de fichier distant (dev sans serveur, ou fichier absent)
    }

    if (remote && remote.narrativeLines && remote.storyUnits) {
      const remoteTime = new Date(remote.updatedAt || 0).getTime();
      const localTime = new Date(local?.updatedAt || 0).getTime();

      if (!local || !local.narrativeLines?.length || remoteTime > localTime) {
        this._cache = remote;
        this._saveLocal(remote);
      } else {
        this._cache = local;
      }
    } else {
      this._cache = local || this._getDefaultProject();
    }

    this._ready = true;
    this._onReady.forEach(fn => fn());
    this._onReady = [];
  }

  onReady(fn) {
    if (this._ready) fn();
    else this._onReady.push(fn);
  }

  _loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveLocal(project) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  }

  load() {
    if (this._cache) return this._cache;
    const local = this._loadLocal();
    this._cache = local || this._getDefaultProject();
    return this._cache;
  }

  save(project) {
    project.updatedAt = new Date().toISOString();
    this._cache = project;
    this._saveLocal(project);
  }

  getLines() {
    return this.load().narrativeLines;
  }

  saveLine(line) {
    const project = this.load();
    const idx = project.narrativeLines.findIndex(l => l.id === line.id);
    line.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      project.narrativeLines[idx] = line;
    } else {
      project.narrativeLines.push(line);
    }
    this.save(project);
  }

  deleteLine(lineId) {
    const project = this.load();
    project.narrativeLines = project.narrativeLines.filter(l => l.id !== lineId);
    for (const line of project.narrativeLines) {
      line.dependencies = line.dependencies.filter(d => d !== lineId);
    }
    for (const unit of project.storyUnits) {
      unit.advancedLines = unit.advancedLines.filter(id => id !== lineId);
    }
    this.save(project);
  }

  getUnits() {
    return this.load().storyUnits;
  }

  saveUnit(unit) {
    const project = this.load();
    const idx = project.storyUnits.findIndex(u => u.id === unit.id);
    unit.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      project.storyUnits[idx] = unit;
    } else {
      project.storyUnits.push(unit);
    }
    this.save(project);
  }

  deleteUnit(unitId) {
    const project = this.load();
    project.storyUnits = project.storyUnits.filter(u => u.id !== unitId);
    this.save(project);
  }

  getSettings() {
    return this.load().settings;
  }

  saveSettings(settings) {
    const project = this.load();
    project.settings = { ...project.settings, ...settings };
    this.save(project);
  }

  getProjectName() {
    return this.load().name;
  }

  saveProjectName(name) {
    const project = this.load();
    project.name = name;
    this.save(project);
  }

  exportProject() {
    return JSON.stringify(this.load(), null, 2);
  }

  importProject(jsonString) {
    const project = JSON.parse(jsonString);
    if (!project.narrativeLines || !project.storyUnits) {
      throw new Error('Format de projet invalide');
    }
    this.save(project);
    return project;
  }

  reset() {
    this._cache = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

const storage = new StorageService();
export default storage;
