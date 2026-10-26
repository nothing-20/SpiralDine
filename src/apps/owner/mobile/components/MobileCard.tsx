import React from 'react';

interface MobileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  className = '',
  onClick,
  interactive = false,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
        interactive || onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default MobileCard;
