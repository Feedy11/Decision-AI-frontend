import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHighcharts } from 'highcharts-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import {
  Activity, AlertCircle, ArrowLeft, BarChart2,
  Bell,
  Check, CheckSquare, ChevronDown, ChevronLeft, ChevronRight,
  Database, GitMerge,
  Info, LayoutDashboard, Lock, Loader, LogOut, LucideAngularModule,
  MessageSquare, Plus,
  RefreshCw, Search, Settings, Share2, Sparkles, Star, Trash2,
  UploadCloud, User, Users,
  FileText
} from 'lucide-angular';

import { HIGHCHARTS_GLOBAL_OPTIONS } from './shared/highcharts/highcharts-global-defaults';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHighcharts({
      modules: () => [
        import('highcharts/modules/accessibility'),
        import('highcharts/modules/heatmap'),
      ],
      options: HIGHCHARTS_GLOBAL_OPTIONS,
    }),
    provideAnimations(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    importProvidersFrom(
      LucideAngularModule.pick({
        Activity, AlertCircle, ArrowLeft, BarChart2,
        Bell, Check, CheckSquare, ChevronLeft, ChevronRight, ChevronDown,
        Database, GitMerge, Info, LayoutDashboard,
        Lock, Loader, LogOut, MessageSquare, Plus, RefreshCw,
        Search, Settings, Share2, Sparkles, Star, Trash2,
        UploadCloud, User, Users,FileText,
      })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideToastr({
      positionClass: 'toast-top-right',
      timeOut: 4000,
      extendedTimeOut: 1000,
      easeTime: 300,
      progressBar: true,
      progressAnimation: 'decreasing',
      closeButton: true,
      tapToDismiss: true,
      preventDuplicates: true,
      resetTimeoutOnDuplicate: true,
      newestOnTop: true,
      maxOpened: 5,
      autoDismiss: true,
      toastClass: 'ngx-toastr custom-toast',
      easing: 'ease-in-out',
      enableHtml: true,
      iconClasses: {
        error: 'toast-error',
        info: 'toast-info',
        success: 'toast-success',
        warning: 'toast-warning',
      },
    }),
  ]
};
