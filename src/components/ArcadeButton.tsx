import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
export function ArcadeButton({ children, className = '', ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={`arcade-button ${className}`} {...props}>{children}</button>;
}
