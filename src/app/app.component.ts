import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChatPanelComponent } from './chat-panel/chat-panel.component';
import { DataSidebarComponent } from './shared/data-sidebar/data-sidebar.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { WorkflowStepperComponent } from './shared/workflow-stepper/workflow-stepper.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, CommonModule,
    ChatPanelComponent, DataSidebarComponent,
    NavbarComponent, WorkflowStepperComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'frontend';
}
