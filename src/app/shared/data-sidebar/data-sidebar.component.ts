import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IaServicesService } from '../../core/services/ia-services.service';
import { WorkflowService } from '../../core/services/workflow.service';
import { filter } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';
import { IA_API_BASE } from '../../core/config/api-base';

// Routes publiques : on cache la sidebar
const PUBLIC_ROUTES = ['/login', '/pass', '/reset-password'];

@Component({
  selector: 'app-data-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './data-sidebar.component.html',
  styleUrl: './data-sidebar.component.css'
})
export class DataSidebarComponent implements OnInit {

  isOpen = true;
  datasetCount = 0;
  isAdmin = false;
  isMobile = false;
  isPublicRoute = false;
  showMobileBackdrop = false;

  // User info
  userFullName = '';
  userInitials = '';
  avatarUrl: string | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private iaService: IaServicesService,
    private router: Router,
    public wf: WorkflowService
  ) {
    this.checkMobile();
    // Start closed on mobile
    if (this.isMobile) {
      this.isOpen = false;
    }
  }

  ngOnInit(): void {
    this.isAdmin = this.auth.isSuperuser();
    this.loadDatasetCount();
    this.loadUser();
    this.checkRoute(this.router.url);

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.checkRoute(e.urlAfterRedirects);
        this.loadUser();
        // Auto-close sidebar on navigation for mobile
        if (this.isMobile && this.isOpen) {
          this.close();
        }
      });

    // Listen for avatar changes from profile page
    window.addEventListener('storage', (e) => {
      if (e.key === 'user_avatar') {
        this.avatarUrl = e.newValue;
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.isMobile;
    this.checkMobile();
    // Close sidebar when switching to mobile view
    if (this.isMobile && !wasMobile) {
      this.isOpen = false;
      this.showMobileBackdrop = false;
    }
    // Re-open sidebar when switching to desktop view
    if (!this.isMobile && wasMobile) {
      this.isOpen = true;
      this.showMobileBackdrop = false;
    }
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private checkRoute(url: string): void {
    this.isPublicRoute = PUBLIC_ROUTES.some(r => url.startsWith(r));
  }

  private loadUser(): void {
    const user = this.auth.getUser();
    if (user) {
      this.userFullName = user.full_name || 'Utilisateur';
      this.userInitials = (user.full_name || 'U')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      this.isAdmin = user.is_superuser;
    }
    // Load avatar from localStorage
    this.avatarUrl = localStorage.getItem('user_avatar') || null;
  }

  private loadDatasetCount(): void {
    this.http
      .get<{ total: number }>(
        `${IA_API_BASE}/datasets/my-datasets?page=1&page_size=1`
      )
      .subscribe({
        next: (res) => {
          this.datasetCount = res.total ?? 0;
        },
        error: () => { }
      });
  }

  togglePanel(): void {
    this.isOpen = !this.isOpen;
    this.showMobileBackdrop = this.isMobile && this.isOpen;
  }

  close(): void {
    this.isOpen = false;
    this.showMobileBackdrop = false;
  }

  /** Close sidebar when user clicks on backdrop (mobile only) */
  onBackdropClick(): void {
    this.close();
  }

  goToDashboard(): void { this.router.navigate(['/dashboard']); }
  goToProfile(): void { this.router.navigate(['/profile']); }

  startWorkflow(): void {
    this.wf.resetWorkflow();
  }

  logout(): void {
    this.auth.logout();
  }
}
