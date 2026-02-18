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
   * Charge data/project.json — source de vérité unique.
   * Pas de localStorage : le fichier du dépôt fait foi.
   * Les modifications locales passent par export/import.
   */
  async init() {
    try {
      const res = await fetch(DATA_FILE);
      if (res.ok) {
        this._cache = await res.json();
      }
    } catch {
      // Pas de fichier (dev sans serveur)
    }

    if (!this._cache || !this._cache.narrativeLines) {
      this._cache = this._getDefaultProject();
    }

    this._ready = true;
    this._onReady.forEach(fn => fn());
    this._onReady = [];
  }

  onReady(fn) {
    if (this._ready) fn();
    else this._onReady.push(fn);
  }

  load() {
    if (this._cache) return this._cache;
    this._cache = this._getDefaultProject();
    return this._cache;
  }

  save(project) {
    project.updatedAt = new Date().toISOString();
    this._cache = project;
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
  }
}

const storage = new StorageService();
export default storage;
