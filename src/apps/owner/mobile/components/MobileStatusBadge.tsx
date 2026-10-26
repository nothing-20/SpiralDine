import React from 'react';

export type OrderStatusType = 
  | 'PENDING' 
  | 'NEW'
  | 'PREPARING' 
  | 'READY' 
  | 'SERVED' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'REFUNDED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'OCCUPIED'
  | 'AVAILABLE'
  | 'RESERVED'
  | string;

interface MobileStatusBadgeProps {
  status: OrderStatusType;
  size?: 'sm' | 'md';
}

export const MobileStatusBadge: React.FC<MobileStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const norm = String(status || '').toUpperCase();

  let bg = 'bg-[#F3F4F6]';
  let text = 'text-[#4B5563]';
  let label = norm;

  switch (norm) {
    case 'PENDING':
    case 'NEW':
      bg = 'bg-[#FEF3C7]';
      text = 'text-[#D97706]';
      label = 'New Order';
      break;
    case 'PREPARING':
      bg = 'bg-[#EFF6FF]';
      text = 'text-[#2563EB]';
      label = 'Preparing';
      break;
    case 'READY':
      bg = 'bg-[#F5F3FF]';
      text = 'text-[#7C3AED]';
      label = 'Ready';
      break;
    case 'SERVED':
    case 'COMPLETED':
      bg = 'bg-[#DCFCE7]';
      text = 'text-[#16A34A]';
      label = 'Completed';
      break;
    case 'CANCELLED':
    case 'REJECTED':
      bg = 'bg-[#FEE2E2]';
      text = 'text-[#DC2626]';
      label = 'Cancelled';
      break;
    case 'REFUNDED':
      bg = 'bg-[#F1F5F9]';
      text = 'text-[#64748B]';
      label = 'Refunded';
      break;
    case 'AVAILABLE':
    case 'ACTIVE':
      bg = 'bg-[#DCFCE7]';
      text = 'text-[#16A34A]';
      label = norm === 'AVAILABLE' ? 'Available' : 'Active';
      break;
    case 'OCCUPIED':
      bg = 'bg-[#FEF3C7]';
      text = 'text-[#D97706]';
      label = 'Occupied';
      break;
    case 'RESERVED':
      bg = 'bg-[#DBEAFE]';
      text = 'text-[#1D4ED8]';
      label = 'Reserved';
      break;
    default:
      break;
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center justify-center font-bold rounded-full ${bg} ${text} ${px} tracking-wide select-none`}
    >
      {label}
    </span>
  );
};

export default MobileStatusBadge;
