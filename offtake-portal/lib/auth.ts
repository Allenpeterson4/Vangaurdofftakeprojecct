export type PortalRole = 'admin' | 'manager';

export interface PortalUser {
  id: string;
  email: string;
  full_name: string;
  role: PortalRole;
  supplier_id: string | null;
}
