export type AuthProvider = 'local' | 'phone' | 'google' | 'facebook';

export interface UserPreferences {
  locale?: 'en' | 'fr';
  timezone?: string;
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  smsReminders?: boolean;
}

export interface User {
  id: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  provider: AuthProvider;
  providerId?: string;
  name?: string;
  role?: 'admin' | 'user';
  /** Email verified via verification code (sign-up flow) */
  emailVerified?: boolean;
  /** Phone verified via OTP (sign-up or login) */
  phoneVerified?: boolean;
  /** User preferences (synced across devices) */
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}
