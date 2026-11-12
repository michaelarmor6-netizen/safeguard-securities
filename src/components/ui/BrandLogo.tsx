import { useTheme } from '../../contexts/ThemeContext';

interface BrandLogoProps {
  className?: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
}

// The brand lockup ships in two variants generated from the same master
// artwork (see scripts/generate-logo-variants.mjs):
//   /sslogo.png       - white wordmark, for dark surfaces (default theme)
//   /sslogo-dark.png  - navy wordmark, for light surfaces
// BrandLogo picks the right one for the active app theme and re-renders
// automatically when the user toggles between dark and light.
export default function BrandLogo({ className, alt = 'SafeGuard Securities, LLC', loading }: BrandLogoProps) {
  const { theme } = useTheme();
  return (
    <img
      src={theme === 'light' ? '/sslogo-dark.png' : '/sslogo.png'}
      alt={alt}
      className={className}
      loading={loading}
    />
  );
}
