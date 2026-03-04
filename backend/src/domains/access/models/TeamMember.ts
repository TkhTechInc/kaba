import type { Role } from '../role.types';

export interface TeamMember {
  userId: string;
  /** Either organizationId or businessId - scope of membership */
  organizationId?: string;
  businessId?: string;
  role: Role;
  createdAt: string;
}
