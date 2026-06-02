import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { WorkflowService } from '../../core/services/workflow.service';
import { WorkflowStep } from '../../models/WorkflowStep.model';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-workflow-stepper',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslocoPipe],
  templateUrl: './workflow-stepper.component.html',
  styleUrls: ['./workflow-stepper.component.css']
})
export class WorkflowStepperComponent implements OnInit, OnDestroy {

  steps: WorkflowStep[] = [];
  currentIndex = 0;
  isVisible = false;

  private subs = new Subscription();

  constructor(
    public wf: WorkflowService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to steps
    this.subs.add(
      this.wf.steps$.subscribe(steps => this.steps = steps)
    );

    // Subscribe to current index
    this.subs.add(
      this.wf.currentIndex$.subscribe(idx => this.currentIndex = idx)
    );

    // Watch navigation events
    this.subs.add(
      this.router.events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd)
      ).subscribe(e => {
        this.isVisible = this.wf.isWorkflowRoute(e.urlAfterRedirects);
        if (this.isVisible) {
          this.wf.syncWithRoute(e.urlAfterRedirects);
        }
      })
    );

    // Initial check
    this.isVisible = this.wf.isWorkflowRoute(this.router.url);
    if (this.isVisible) {
      this.wf.syncWithRoute(this.router.url);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onStepClick(index: number): void {
    this.wf.goToStep(index);
  }

  onNext(): void {
    this.wf.next();
  }

  onPrevious(): void {
    this.wf.previous();
  }

  onExit(): void {
    this.router.navigate(['/dashboard']);
  }

  onRestart(): void {
    this.wf.resetWorkflow();
  }
}
