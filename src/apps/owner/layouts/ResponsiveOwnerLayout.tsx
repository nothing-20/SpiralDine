import React from 'react';
import { useIsMobile } from '../../../hooks/useViewport';
import MobileOwnerLayout from '../mobile/layout/MobileOwnerLayout';
import DashboardLayout from '../../../shared/ui/layouts/DashboardLayout';

/**
 * Unified Responsive Owner Layout:
 * Dynamically renders the mobile 5-tab owner layout on mobile phones (< 768px),
 * and seamlessly preserves the desktop/tablet sidebar & navbar layout on tablets,
 * laptops, and desktop viewports (>= 768px).
 *
 * Automatically adapts on window resize without requiring any URL change.
 */
export const ResponsiveOwnerLayout: React.FC = () => {
  const isMobile = useIsMobile(768);

  if (isMobile) {
    return <MobileOwnerLayout />;
  }

  return <DashboardLayout />;
};

export default ResponsiveOwnerLayout;
