export interface JwtPayload {
  sub: string;
  /** Optional; frontend typically sends businessId per request for multi-tenant */
  businessId?: string;
  organizationId?: string;
  phone?: string;
  email?: string;
  role?: 'admin' | 'user';
  /** Email verified via sign-up verification flow */
  emailVerified?: boolean;
  /** Phone verified via OTP */
  phoneVerified?: boolean;
  iat?: number;
  exp?: number;
}

export interface ApiKeyPayload {
  sub: 'apikey';
  businessId: string;
  scopes: string[];
  keyId: string;
}

export type AuthUser = JwtPayload | ApiKeyPayload;
