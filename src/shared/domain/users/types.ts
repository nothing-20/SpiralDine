export type TUserRole = 'super_admin' | 'super-admin' | 'owner' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'reception' | 'customer';

export type TAuthStatus = 'AUTH_LOADING' | 'PROFILE_LOADING' | 'AUTHORIZED' | 'UNAUTHORIZED' | 'PROFILE_MISSING';

export interface IUser {
  uid: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: TUserRole;
  status: 'active' | 'inactive';
  phoneNumber?: string;
  createdAt: string;
}
