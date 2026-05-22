import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { WorkflowStep } from '../../models/WorkflowStep.model';



@Injectable({ providedIn: 'root' })
export class WorkflowService {

  private readonly STORAGE_KEY = 'decision_ai_workflow';

  /** The ordered workflow steps */
  private readonly defaultSteps: WorkflowStep[] = [
    {
      id: 'upload',
      label: 'Upload',
      description: 'Importer vos données',
      route: '/workflow/upload',
      icon: 'upload-cloud',
      completed: false,
      active: false,
      accessible: true        // always accessible — entry point
    },
    {
      id: 'cleaning',
      label: 'Nettoyage',
      description: 'Nettoyer et valider',
      route: '/workflow/cleaning',
      icon: 'sparkles',
      completed: false,
      active: false,
      accessible: false
    },
    {
      id: 'analysis',
      label: 'Analyse',
      description: 'Analyser les relations',
      route: '/workflow/analysis',
      icon: 'bar-chart-2',
      completed: false,
      active: false,
      accessible: false
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Visualiser les KPIs',
      route: '/workflow/dashboard',
      icon: 'layout-dashboard',
      completed: false,
      active: false,
      accessible: false
    }
  ];

  private steps: WorkflowStep[] = [];

  private stepsSubject = new BehaviorSubject<WorkflowStep[]>([]);
  steps$ = this.stepsSubject.asObservable();

  private currentIndexSubject = new BehaviorSubject<number>(0);
  currentIndex$ = this.currentIndexSubject.asObservable();

  private datasetIdSubject = new BehaviorSubject<number | null>(null);
  datasetId$ = this.datasetIdSubject.asObservable();

  setDatasetId(id: number | null): void {
    this.datasetIdSubject.next(id);
    this.saveState();
  }

  getDatasetId(): number | null {
    return this.datasetIdSubject.value;
  }

  constructor(private router: Router) {
    this.steps = this.deepClone(this.defaultSteps);
    this.loadState();
    this.stepsSubject.next([...this.steps]);
  }

  get currentIndex(): number {
    return this.currentIndexSubject.value;
  }

  get allSteps(): WorkflowStep[] {
    return this.steps;
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  get completedCount(): number {
    return this.steps.filter(s => s.completed).length;
  }

  get progressPercent(): number {
    return Math.round((this.completedCount / this.totalSteps) * 100);
  }

  get isFirstStep(): boolean {
    return this.currentIndex === 0;
  }

  get isLastStep(): boolean {
    return this.currentIndex === this.steps.length - 1;
  }

  get canGoNext(): boolean {
    if (this.isLastStep) return false;
    // The current step must be completed before moving forward
    return this.steps[this.currentIndex].completed && this.steps[this.currentIndex + 1].accessible;
  }

  get canGoPrev(): boolean {
    return this.currentIndex > 0;
  }

  ///Navigation

  //Called by router events to sync index with active route
  syncWithRoute(url: string): void {
    const index = this.steps.findIndex(s => url.startsWith(s.route));
    if (index !== -1) {
      this.setActiveStep(index);
    }
  }

  // Returns true if a given route belongs to the workflow
  isWorkflowRoute(url: string): boolean {
    return this.steps.some(s => url.startsWith(s.route));
  }

  //Can this route be accessed right now? Used by guard
  canAccessRoute(route: string): boolean {
    const step = this.steps.find(s => route.startsWith(s.route));
    return step ? step.accessible : true;
  }

  /** Mark current step done and unlock next */
  completeCurrentStep(): void {
    const idx = this.currentIndex;
    this.steps[idx].completed = true;

    // unlock next step
    if (idx + 1 < this.steps.length) {
      this.steps[idx + 1].accessible = true;
    }

    this.publish();
  }

  /** Navigate forward (only if current step is completed) */
  next(): void {
    if (!this.canGoNext) return;
    this.router.navigate([this.steps[this.currentIndex + 1].route]);
  }

  /** Navigate back */
  previous(): void {
    if (!this.canGoPrev) return;
    this.router.navigate([this.steps[this.currentIndex - 1].route]);
  }

  /** Navigate to a specific step (only if accessible) */
  goToStep(index: number): void {
    if (index >= 0 && index < this.steps.length && this.steps[index].accessible) {
      this.router.navigate([this.steps[index].route]);
    }
  }

  /** Reset entire workflow (re-upload scenario) */
  resetWorkflow(): void {
    this.steps = this.deepClone(this.defaultSteps);
    this.datasetIdSubject.next(null);
    this.setActiveStep(0);
    this.router.navigate([this.steps[0].route]);
  }

  /* ─── Internal ──────────────────────────────────────── */

  private setActiveStep(index: number): void {
    this.steps.forEach((s, i) => {
      s.active = i === index;
      // Steps before the current one are considered done only if they were accessible
      if (i < index) {
        s.completed = s.accessible;
      }
      // Don't override completed status for current or future steps
      // (let the component's completeCurrentStep() call handle it)
    });
    this.currentIndexSubject.next(index);
    this.publish();
  }

  private publish(): void {
    this.stepsSubject.next([...this.steps]);
    this.saveState();
  }

  private saveState(): void {
    const state = {
      steps: this.steps.map(s => ({
        id: s.id,
        completed: s.completed,
        accessible: s.accessible
      })),
      datasetId: this.datasetIdSubject.value
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  private loadState(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      
      const savedSteps = Array.isArray(parsed) ? parsed : parsed.steps;
      if (parsed && !Array.isArray(parsed) && parsed.datasetId) {
        this.datasetIdSubject.next(parsed.datasetId);
      }

      if (savedSteps) {
        savedSteps.forEach((s: any) => {
          const step = this.steps.find(x => x.id === s.id);
          if (step) {
            step.accessible = s.accessible;
            step.completed = s.completed;
          }
        });
      }
    } catch {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private deepClone(arr: WorkflowStep[]): WorkflowStep[] {
    return arr.map(s => ({ ...s }));
  }
}

