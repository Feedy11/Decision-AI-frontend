import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WorkflowService } from '../services/workflow.service';
import { ToastrService } from 'ngx-toastr';

/**

* Protection garantissant l'accès séquentiel aux étapes du flux de travail.

* Redirige vers la dernière étape accessible si l'utilisateur tente de
* passer à l'étape suivante.

*/
export const workflowGuard: CanActivateFn = (route) => {
  const wf     = inject(WorkflowService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  // Build the full path from the route snapshot
  const fullPath = '/' + route.pathFromRoot
    .map(r => r.url.map(s => s.path).join('/'))
    .filter(Boolean)
    .join('/');

  if (wf.canAccessRoute(fullPath)) {
    return true;
  }

  // Find the last accessible step
  const lastAccessible = [...wf.allSteps]
    .reverse()
    .find(s => s.accessible);

  toastr.warning(
    'Veuillez compléter les étapes précédentes avant de continuer.',
    'Accès restreint',
    { timeOut: 3500, progressBar: true }
  );

  return router.createUrlTree([lastAccessible?.route ?? '/workflow/upload']);
};
