import { Component, OnInit, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';

// Routes publiques affiche seulement le logo
const PUBLIC_ROUTES = ['/login', '/pass', '/reset-password'];

@Component({
  selector   : 'app-navbar',
  standalone : true,
  imports    : [ CommonModule, LucideAngularModule],
  templateUrl: './navbar.component.html',
  styleUrl   : './navbar.component.css'
})
export class NavbarComponent implements OnInit {

  userFullName  = '';
  userInitials  = '';
  isAdmin       = false;
  isPublicRoute = false;
  avatarUrl: string | null = null;
  profileDropdownOpen = false;

  constructor(
    private router: Router,
    private auth  : AuthService,
  ) {}

  ngOnInit(): void {
    this.loadUser();
    this.checkRoute(this.router.url);

    //update chaque changement de page
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.checkRoute(e.urlAfterRedirects);
        this.loadUser();
      });

    // Listen for avatar changes from profile page
    window.addEventListener('storage', (e) => {
      if (e.key === 'user_avatar') {
        this.avatarUrl = e.newValue;
      }
    });
  }

  /** Close dropdown when clicking outside */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const profileEl = document.getElementById('navbar-profile');
    if (profileEl && !profileEl.contains(event.target as Node)) {
      this.profileDropdownOpen = false;
    }
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

  toggleProfileDropdown(): void {
    this.profileDropdownOpen = !this.profileDropdownOpen;
  }

  closeDropdown(): void {
    this.profileDropdownOpen = false;
  }

  goToDashboard(): void { this.router.navigate(['/dashboard']); }
  goToUpload():void {this.router.navigate(['/upload'])}
  goToAdmin()    : void { this.router.navigate(['/admin/users']); }
  goToProfile()  : void { this.router.navigate(['/profile']); }
  logout()       : void { this.auth.logout(); }

  toggleMenu(): void {
    document.getElementById('mobileMenu')?.classList.toggle('open');
  }
}
