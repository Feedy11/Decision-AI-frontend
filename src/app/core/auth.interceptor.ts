import { inject }                          from '@angular/core';
import { HttpInterceptorFn, HttpRequest,
         HttpHandlerFn, HttpEvent }         from '@angular/common/http';
import { Observable }                      from 'rxjs';

/**

* Ajoute automatiquement le jeton Bearer stocké dans le stockage local

* à chaque requête HTTP sortante, SAUF au point de terminaison de connexion
* (qui utilise x-www-form-urlencoded et ne doit PAS comporter d'en-tête Bearer).

*/
export const authInterceptor: HttpInterceptorFn = (
  req   : HttpRequest<unknown>,
  next  : HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const token = localStorage.getItem('access_token');

  // Skip injecting token for the login endpoint
  const isLoginEndpoint = req.url.includes('/login/access-token');

  if (token && !isLoginEndpoint) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(authReq);
  }

  return next(req);
};
