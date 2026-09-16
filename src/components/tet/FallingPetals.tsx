import { useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Petal {
  id: number;
  type: 'peach' | 'apricot';
  left: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

// SVG paths for petals
const PeachPetal = ({ size, rotation }: { size: number; rotation: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ transform: `rotate(${rotation}deg)` }}
  >
    <ellipse
      cx="12"
      cy="12"
      rx="8"
      ry="10"
      fill="rgba(255, 182, 193, 0.6)"
      stroke="rgba(255, 105, 180, 0.3)"
      strokeWidth="0.5"
    />
    <ellipse
      cx="12"
      cy="10"
      rx="3"
      ry="4"
      fill="rgba(255, 255, 255, 0.4)"
    />
  </svg>
);

const ApricotPetal = ({ size, rotation }: { size: number; rotation: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ transform: `rotate(${rotation}deg)` }}
  >
    <ellipse
      cx="12"
      cy="12"
      rx="9"
      ry="8"
      fill="rgba(255, 215, 0, 0.5)"
      stroke="rgba(255, 193, 37, 0.3)"
      strokeWidth="0.5"
    />
    <ellipse
      cx="12"
      cy="10"
      rx="4"
      ry="3"
      fill="rgba(255, 255, 255, 0.35)"
    />
  </svg>
);

export function FallingPetals() {
  const isMobile = useIsMobile();
  
  const petals = useMemo<Petal[]>(() => {
    const count = isMobile ? 6 : 12; // Phương án B: 5-8 mobile, 10-15 desktop
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      type: Math.random() > 0.5 ? 'peach' : 'apricot',
      left: Math.random() * 100,
      delay: Math.random() * 20,
      duration: 18 + Math.random() * 7, // 18-25s (Phương án B)
      size: 12 + Math.random() * 8, // 12-20px (Phương án B)
      rotation: Math.random() * 360,
    }));
  }, [isMobile]);

  return (
    <div className="tet-petals-container">
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="tet-petal"
          style={{
            left: `${petal.left}%`,
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
          }}
        >
          {petal.type === 'peach' ? (
            <PeachPetal size={petal.size} rotation={petal.rotation} />
          ) : (
            <ApricotPetal size={petal.size} rotation={petal.rotation} />
          )}
        </div>
      ))}
    </div>
  );
}
