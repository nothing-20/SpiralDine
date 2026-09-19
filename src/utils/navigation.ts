import { TUserRole } from '../types';

/**
 * Explicit role-to-dashboard route resolution.
 * Sourced strictly from the user's authenticated account profile.
 */
export function getDashboardRoute(role: TUserRole | string | null | undefined): string {
  if (!role) {
    return '/unauthorized';
  }

  const normalizedRole = role.toLowerCase().trim().replace('_', '-');

  switch (normalizedRole) {
    case 'super-admin':
    case 'superadmin':
      return '/super-admin/dashboard';

    case 'owner':
    case 'admin':
    case 'restaurant-owner':
    case 'restaurantowner':
      return '/owner/dashboard';

    case 'manager':
      return '/dashboard/manager';

    case 'waiter':
      return '/dashboard/waiter';

    case 'kitchen':
      return '/dashboard/kitchen';

    case 'cashier':
      return '/dashboard/cashier';

    case 'reception':
      return '/dashboard/reception';

    case 'customer':
      return '/customer/home';

    default:
      console.warn(`[getDashboardRoute] Unrecognized role: "${role}". Navigating to /unauthorized.`);
      return '/unauthorized';
  }
}
