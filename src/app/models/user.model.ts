// ──────────────────────────────────────────────────────────────────────────────
// user.model.ts
// Mirrors exactly the Pydantic / SQLModel schemas in backend/app/models.py
// ──────────────────────────────────────────────────────────────────────────────

/** Returned by GET /users/me  and  GET /users/{user_id} */
export interface UserPublic {
  id         : string;          // UUID as string
  email      : string;
  is_active  : boolean;
  is_superuser: boolean;
  full_name  : string | null;
  created_at : string | null;   // ISO-8601 datetime
}

/** Paginated list returned by GET /users/ */
export interface UsersPublic {
  data : UserPublic[];
  count: number;
}

/** Body for POST /users/  (superuser only) */
export interface UserCreate {
  email       : string;
  password    : string;
  full_name  ?: string | null;
  is_active  ?: boolean;
  is_superuser?: boolean;
}

/** Body for POST /users/signup  (public self-registration) */
export interface UserRegister {
  email    : string;
  password : string;
  full_name?: string | null;
}

/** Body for PATCH /users/me */
export interface UserUpdateMe {
  full_name?: string | null;
  email    ?: string;
}

/** Body for PATCH /users/{user_id}  (superuser only) */
export interface UserUpdate {
  email       ?: string;
  password    ?: string;
  full_name   ?: string | null;
  is_active   ?: boolean;
  is_superuser?: boolean;
}

/** Body for PATCH /users/me/password */
export interface UpdatePassword {
  current_password: string;
  new_password    : string;
}

/** Generic API message response */
export interface Message {
  message: string;
}
