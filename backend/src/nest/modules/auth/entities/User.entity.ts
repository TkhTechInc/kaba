export type AuthProvider = 'local' | 'phone' | 'google' | 'facebook';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  provider: AuthProvider;
  providerId?: string;
  role?: 'admin' | 'user';
  /** Email verified via verification code (sign-up flow) */
  emailVerified?: boolean;
  /** Phone verified via OTP (sign-up or login) */
  phoneVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}
