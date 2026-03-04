import type { Role } from '../role.types';

export interface Invitation {
  id: string;
  /** Email or phone of invitee */
  emailOrPhone: string;
  businessId: string;
  role: Role;
  token: string;
  expiresAt: string;
  createdAt: string;
  /** userId of inviter */
  invitedBy?: string;
}
