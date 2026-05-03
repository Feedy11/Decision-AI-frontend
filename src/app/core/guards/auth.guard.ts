import { inject }          from '@angular/core';
import { CanActivateFn }   from '@angular/router';
import { Router }          from '@angular/router';
import { AuthService } from '../services/auth.service';


/**
 * Protects routes that require the user to be logged in.
 * Redirects to /login if no valid token is found.
 */
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Prevents logged-in users from accessing /login again.
 * Redirects to /dashboard if already authenticated.
 */
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/**
 * Ensures user is logged in AND is a superuser.
 */
export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn() && auth.isSuperuser()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
