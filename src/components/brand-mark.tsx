import Image from 'next/image';
import logo from '../../public/turnout_logo.png';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-mark-small' : 'brand-icon'} aria-hidden="true">
      <Image src={logo} alt="" sizes={compact ? '24px' : '48px'} />
    </span>
  );
}
