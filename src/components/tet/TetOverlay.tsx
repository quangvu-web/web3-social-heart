import { useTetTheme } from '@/contexts/TetThemeContext';
import { FallingPetals } from './FallingPetals';
import { useIsMobile } from '@/hooks/use-mobile';

// Hoa Đào (Peach Blossom) - Góc trái
const PeachBlossomCorner = ({ opacity }: { opacity: number }) => (
  <svg
    viewBox="0 0 200 200"
    className="tet-corner-left"
    style={{ opacity }}
  >
    {/* Nhánh cây */}
    <path
      d="M0 0 Q 40 60, 80 100 Q 100 120, 120 160"
      stroke="#8B4513"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M20 0 Q 50 40, 60 80"
      stroke="#8B4513"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    
    {/* Hoa đào 1 - lớn */}
    <g transform="translate(50, 50)">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-12"
          rx="8"
          ry="12"
          fill="#FFB6C1"
          stroke="#FF69B4"
          strokeWidth="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle cx="0" cy="0" r="5" fill="#FFD700" />
      <circle cx="0" cy="0" r="2" fill="#FFA500" />
    </g>
    
    {/* Hoa đào 2 */}
    <g transform="translate(90, 80)">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-10"
          rx="6"
          ry="10"
          fill="#FFC0CB"
          stroke="#FF69B4"
          strokeWidth="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle cx="0" cy="0" r="4" fill="#FFD700" />
    </g>
    
    {/* Hoa đào 3 - nhỏ */}
    <g transform="translate(30, 90)">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-8"
          rx="5"
          ry="8"
          fill="#FFB6C1"
          stroke="#FF69B4"
          strokeWidth="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle cx="0" cy="0" r="3" fill="#FFD700" />
    </g>
    
    {/* Nụ hoa */}
    <ellipse cx="110" cy="130" rx="4" ry="6" fill="#FF69B4" />
    <ellipse cx="70" cy="60" rx="3" ry="5" fill="#FFB6C1" />
  </svg>
);

// Hoa Mai (Apricot Blossom) - Góc phải
const ApricotBlossomCorner = ({ opacity }: { opacity: number }) => (
  <svg
    viewBox="0 0 200 200"
    className="tet-corner-right"
    style={{ opacity }}
  >
    {/* Nhánh cây */}
    <path
      d="M200 0 Q 160 60, 120 100 Q 100 120, 80 160"
      stroke="#654321"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M180 0 Q 150 40, 140 80"
      stroke="#654321"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    
    {/* Hoa mai 1 - lớn */}
    <g transform="translate(150, 50)">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-12"
          rx="8"
          ry="12"
          fill="#FFD700"
          stroke="#FFC125"
          strokeWidth="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle cx="0" cy="0" r="5" fill="#8B4513" />
      <circle cx="0" cy="0" r="2" fill="#654321" />
    </g>
    
    {/* Hoa mai 2 */}
    <g transform="translate(110, 80)">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-10"
          rx="6"
          ry="10"
          fill="#FFEC8B"
          stroke="#FFD700"
          strokeWidth="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle cx="0" cy="0" r="4" fill="#8B4513" />
    </g>
    
    {/* Hoa mai 3 - nhỏ */}
    <g transform="translate(170, 90)">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-8"
          rx="5"
          ry="8"
          fill="#FFD700"
          stroke="#FFC125"
          strokeWidth="0.5"
          transform={`rotate(${angle})`}
        />
      ))}
      <circle cx="0" cy="0" r="3" fill="#8B4513" />
    </g>
    
    {/* Nụ hoa */}
    <ellipse cx="90" cy="130" rx="4" ry="6" fill="#FFD700" />
    <ellipse cx="130" cy="60" rx="3" ry="5" fill="#FFEC8B" />
  </svg>
);

export function TetOverlay() {
  const { tetModeEnabled } = useTetTheme();
  const isMobile = useIsMobile();
  
  // Trang phát nhạc là hình camera của bot Recall: luôn giữ nền đen tối giản.
  if (!tetModeEnabled || window.location.pathname.startsWith('/angel-player/')) return null;

  // Phương án B: opacity 0.25-0.35
  const cornerOpacity = isMobile ? 0.25 : 0.32;

  return (
    <>
      {/* Golden wash background - Phương án B: 0.04 alpha */}
      <div className="tet-bg-wash" />
      
      {/* Overlay container with decorations */}
      <div className="tet-overlay">
        {/* Corner decorations */}
        <PeachBlossomCorner opacity={cornerOpacity} />
        <ApricotBlossomCorner opacity={cornerOpacity} />
        
        {/* Falling petals */}
        <FallingPetals />
      </div>
    </>
  );
}
