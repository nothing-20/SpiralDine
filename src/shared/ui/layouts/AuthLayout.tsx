import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Route-level Auth layout.
 * Individual authentication sub-views render SharedAuthLayout with their
 * specific role parameters, headers, and validations.
 */
export const AuthLayout: React.FC = () => {
  return <Outlet />;
};

export default AuthLayout;
