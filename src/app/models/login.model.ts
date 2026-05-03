// ──────────────────────────────────────────────────────────────────────────────
// login.model.ts
// Mirrors exactly the Token / NewPassword schemas in backend/app/models.py
// ──────────────────────────────────────────────────────────────────────────────

/** Response from POST /login/access-token */
export interface TokenResponse {
  access_token: string;
  token_type  : string;   // always "bearer"
}

/** Body for POST /reset-password/ */
export interface NewPassword {
  token       : string;
  new_password: string;
}
