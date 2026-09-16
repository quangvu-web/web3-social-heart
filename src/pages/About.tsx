import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ArrowLeft, Sparkles } from 'lucide-react';

const About = () => {
  const navigate = useNavigate();

  // Typography styles - elegant serif fonts matching LawOfLight
  const fontStyles = {
    heading: "'Cormorant Garamond', Georgia, serif",
    body: "'Lora', Georgia, serif",
  };

  const divinePrinciples = [
    {
      number: 1,
      title: 'TÌNH YÊU THUẦN KHIẾT LÀ MÃ NGUỒN',
      description: 'Tất cả platforms đều được xây trên tình yêu thương thuần khiết vô điều kiện.',
      icon: '💖'
    },
    {
      number: 2,
      title: 'XÂY GIÁ TRỊ – KHÔNG XÂY KIỂM SOÁT',
      description: 'FUN tạo tự do, không tạo lệ thuộc.',
      icon: '🔓'
    },
    {
      number: 3,
      title: 'THỊNH VƯỢNG LÀ TRẠNG THÁI TỰ NHIÊN',
      description: 'Tiền là Năng Lượng Ánh Sáng tuôn chảy. Tài sản là đủ đầy khi con người sống hài hoà với thiên nhiên và giá trị thật.',
      icon: '💎'
    },
    {
      number: 4,
      title: 'CÔNG NGHỆ PHỤNG SỰ TỈNH THỨC',
      description: 'Blockchain + AI + Tình Yêu Thuần Khiết → Vô tận thịnh vượng',
      icon: '⚡'
    },
    {
      number: 5,
      title: 'KHÔNG AI BỊ BỎ LẠI PHÍA SAU',
      description: 'FUN dành cho mọi linh hồn trên Trái Đất.',
      icon: '🌍'
    }
  ];

  const platforms = [
    { name: 'FUN Profile', description: 'Web3 Social Network', logo: '/fun-profile-logo-40.webp' },
    { name: 'FUN Play', description: 'Web3 Video Platform', logo: '/fun-play-logo-36.webp' },
    { name: 'FUN Planet', description: 'Game Marketplace for Kids', logo: '/fun-planet-logo-36.webp' },
    { name: 'FUN Academy', description: 'Learn & Earn Education', logo: '/fun-academy-logo-36.webp' },
    { name: 'FUN Charity', description: 'Pure Love Charity Network', logo: '/fun-charity-logo-36.webp' },
    { name: 'FUN Wallet', description: 'Bank of Light Economy', logo: '/fun-wallet-logo-36.webp' },
    { name: 'FUN Farm', description: 'Farm to Table Abundance', logo: '/fun-farm-logo-36.webp' },
    { name: 'FUN Treasury', description: 'Ecosystem Treasury', logo: '/fun-treasury-logo-36.webp' },
    { name: 'Green Earth', description: 'Regeneration Platform', logo: '/green-earth-logo-36.webp' },
    { name: 'FUN Ecosystem', description: 'Unified Platform', logo: '/fun-ecosystem-logo-36.webp' }
  ];

  const earnModels = [
    'Learn & Earn',
    'Play & Earn',
    'Invest & Earn',
    'Give & Gain',
    'Share & Have',
    'Own & Earn',
    'Review & Reward',
    'Build & Bounty'
  ];

  const divineAffirmations = [
    'Con là Ánh Sáng Yêu Thương Thuần Khiết của Cha Vũ Trụ.',
    'Con là Ý Chí của Cha Vũ Trụ.',
    'Con là Trí Tuệ của Cha Vũ Trụ.',
    'Con là Hạnh Phúc.',
    'Con là Tình Yêu.',
    'Con là Tiền của Cha.',
    'Con xin Sám Hối Sám Hối Sám Hối.',
    'Con xin Biết Ơn Biết Ơn Biết Ơn, trong Ánh Sáng Yêu Thương Thuần Khiết của Cha Vũ Trụ.'
  ];

  const communityCommitments = [
    'Xây dựng bằng chính trực và tình yêu',
    'Không khai thác – không thao túng – không cạnh tranh',
    'Cùng nhau nâng nhau lên trong ánh sáng',
    'Phụng sự nhân loại bằng trái tim thuần khiết'
  ];

  return (
    <div className="min-h-screen relative overflow-hidden pb-20 lg:pb-0">
      <FacebookNavbar />
      
      {/* Pearl White to Soft Yellow Gradient Background - STATIC */}
      <div className="fixed inset-0 z-0" style={{
        background: 'linear-gradient(180deg, #FFFEF7 0%, #FFF9E6 30%, #FFF5D6 60%, #FFFDF5 100%)'
      }} />
      
      {/* Divine Light Rays from Top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[200%] h-[50vh] md:h-[70vh] z-0 pointer-events-none" style={{
        background: 'conic-gradient(from 180deg at 50% 0%, transparent 25%, rgba(212,175,55,0.15) 30%, rgba(255,255,255,0.4) 35%, rgba(212,175,55,0.15) 40%, transparent 45%, transparent 55%, rgba(212,175,55,0.12) 60%, rgba(255,255,255,0.35) 65%, rgba(212,175,55,0.12) 70%, transparent 75%)',
        filter: 'blur(3px)'
      }} />

      {/* Central Halo Effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[300px] md:w-[500px] h-[300px] md:h-[500px] z-0 pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(255,215,0,0.15) 40%, transparent 70%)',
        filter: 'blur(50px)'
      }} />

      {/* Side Light Beams */}
      <div className="fixed top-0 left-0 w-1/3 h-full z-0 pointer-events-none opacity-40" style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 50%)'
      }} />
      <div className="fixed top-0 right-0 w-1/3 h-full z-0 pointer-events-none opacity-40" style={{
        background: 'linear-gradient(-135deg, rgba(255,255,255,0.6) 0%, transparent 50%)'
      }} />

      {/* Main Content */}
      <div className="relative z-10 pt-16 md:pt-20 py-6 md:py-12 px-3 md:px-4">
        <div className="max-w-5xl mx-auto">
          
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6 hover:bg-yellow-50/50"
            style={{ fontFamily: fontStyles.body, color: '#8B7355' }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>

          {/* Hero Section */}
          <div className="text-center mb-10 md:mb-16">
            <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full mb-6 overflow-hidden" style={{
              background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, rgba(255,255,255,0.9) 60%, transparent 80%)',
              boxShadow: '0 0 80px rgba(212,175,55,0.4), 0 0 120px rgba(255,255,255,0.6)',
              border: '3px solid rgba(212,175,55,0.5)'
            }}>
              <img 
                src="/fun-profile-logo-128.webp" 
                alt="FUN Ecosystem" 
                className="w-full h-full object-cover" 
                style={{ filter: 'drop-shadow(0 0 15px rgba(212,175,55,0.8))' }} 
              />
            </div>
            
            <h1 style={{
              fontFamily: fontStyles.heading,
              fontSize: 'clamp(1.8rem, 8vw, 3.6rem)',
              fontWeight: 600,
              letterSpacing: '0.03em',
              background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 30%, #D4AF37 50%, #B8860B 70%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 8px rgba(212,175,55,0.3))',
              marginBottom: '0.5rem'
            }}>
              HIẾN PHÁP GỐC
            </h1>
            <h2 style={{
              fontFamily: fontStyles.heading,
              fontSize: 'clamp(1.4rem, 6vw, 2.4rem)',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 50%, #D4AF37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.75rem'
            }}>
              CỦA FUN ECOSYSTEM
            </h2>
            <p style={{
              fontFamily: fontStyles.heading,
              fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
              fontWeight: 500,
              letterSpacing: '0.15em',
              color: '#B8860B',
              marginBottom: '0.5rem'
            }}>
              MASTER CHARTER OF FUN ECOSYSTEM
            </p>
            <p style={{
              fontFamily: fontStyles.body,
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              fontWeight: 500,
              color: '#8B7355',
              marginBottom: '1rem'
            }}>
              Nền Kinh Tế Ánh Sáng 5D của Trái Đất Mới
            </p>
            
            {/* Slogan */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mt-4">
              {['Free to Join', 'Free to Use', 'Earn Together', 'With Pure Love'].map((text, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-sm md:text-base" style={{
                  fontFamily: fontStyles.body,
                  background: 'rgba(212,175,55,0.15)',
                  border: '1px solid rgba(212,175,55,0.4)',
                  color: '#B8860B'
                }}>
                  {text}
                </span>
              ))}
            </div>
            
            {/* Golden Divider */}
            <div className="w-32 md:w-48 h-1 mx-auto mt-8 rounded-full" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, #FFD700, #D4AF37, transparent)',
              boxShadow: '0 0 10px rgba(212,175,55,0.5)'
            }} />
          </div>

          {/* Main Content Card */}
          <div className="relative rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-12 mb-6 md:mb-8" style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,250,240,0.9) 100%)',
            border: '2px solid rgba(212,175,55,0.5)',
            boxShadow: '0 10px 60px rgba(212,175,55,0.15), 0 0 0 1px rgba(255,255,255,0.8), inset 0 0 60px rgba(255,255,255,0.5)'
          }}>

            {/* Section I: Tuyên Ngôn Về Nguồn Gốc */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B',
                textShadow: '0 2px 4px rgba(212,175,55,0.2)'
              }}>
                🌍 I. TUYÊN NGÔN VỀ NGUỒN GỐC
              </h2>
              
              <div className="space-y-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                lineHeight: '2',
                color: '#5D4E37'
              }}>
                <p className="font-semibold" style={{ color: '#8B7355' }}>
                  FUN Ecosystem không chỉ là một doanh nghiệp.<br />
                  FUN Ecosystem không chỉ là một xu hướng tiền mã hoá.<br />
                  FUN Ecosystem lớn hơn cả một tập đoàn.
                </p>
                <p className="font-semibold" style={{ color: '#D4AF37' }}>FUN Ecosystem là:</p>
                <ul className="space-y-2 ml-4">
                  <li className="flex gap-2"><span className="text-yellow-600">✨</span> Một nền văn minh Ánh Sáng sống động</li>
                  <li className="flex gap-2"><span className="text-yellow-600">✨</span> Một hệ sinh thái kinh tế mới của Trái Đất 5D</li>
                  <li className="flex gap-2"><span className="text-yellow-600">✨</span> Một nền kinh tế chia sẻ – kết nối – thịnh vượng</li>
                  <li className="flex gap-2"><span className="text-yellow-600">✨</span> Một kênh dẫn Ý Chí – Trí Tuệ – Tình Yêu Thuần Khiết của Cha Vũ Trụ</li>
                </ul>
                
                <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(212,175,55,0.08)' }}>
                  <p className="font-semibold text-center" style={{ color: '#8B7355' }}>
                    FUN ra đời để giúp nhân loại chuyển hoá:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-center">
                    <p>Từ <strong>cạnh tranh</strong> → sang <strong>hợp tác</strong></p>
                    <p>Từ <strong>khan hiếm</strong> → sang <strong>đầy đủ</strong></p>
                    <p>Từ <strong>kinh tế tranh giành</strong> → sang <strong>kinh tế Ánh Sáng</strong></p>
                    <p>Từ <strong>kiểm soát</strong> → sang <strong>tự do & giải phóng</strong></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section II: Sứ Mệnh Trọng Tâm */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                🌟 II. SỨ MỆNH TRỌNG TÂM
              </h2>
              
              <div style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                lineHeight: '2',
                color: '#5D4E37'
              }}>
                <p className="font-semibold mb-4" style={{ color: '#8B7355' }}>Sứ mệnh của FUN Ecosystem là:</p>
                <ul className="space-y-2 ml-4 mb-6">
                  <li className="flex gap-2"><span className="text-yellow-600">✅</span> Gửi tặng phước lành & thịnh vượng cho nhân loại</li>
                  <li className="flex gap-2"><span className="text-yellow-600">✅</span> Phi tập trung hoá cơ hội toàn cầu</li>
                  <li className="flex gap-2"><span className="text-yellow-600">✅</span> Nâng cấp kinh tế song hành với nâng cấp ý thức</li>
                  <li className="flex gap-2"><span className="text-yellow-600">✅</span> Xây dựng các nền tảng để mọi người có thể:</li>
                </ul>
                
                <div className="text-center p-4 rounded-xl mb-6" style={{ background: 'rgba(212,175,55,0.12)' }}>
                  <p className="font-bold text-lg" style={{ color: '#D4AF37' }}>
                    Gia Nhập • Sử Dụng • Kiếm Tiền • Chia Sẻ • Thăng Hoa
                  </p>
                  <p style={{ color: '#8B7355', fontStyle: 'italic' }}>
                    Join • Use • Earn • Share • Rise
                  </p>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'rgba(212,175,55,0.08)' }}>
                  <p className="text-center font-semibold mb-3" style={{ color: '#B8860B' }}>
                    FUN vận hành theo mô hình thiêng liêng: <span style={{ color: '#D4AF37' }}>99% Gift</span> cho cộng đồng toàn cầu
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {earnModels.map((model, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-sm" style={{
                        background: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(212,175,55,0.4)',
                        color: '#6B5B47'
                      }}>
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section III: Các Nguyên Lý Thiêng Liêng */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                💎 III. CÁC NGUYÊN LÝ THIÊNG LIÊNG
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {divinePrinciples.map((principle) => (
                  <div key={principle.number} className="p-4 rounded-xl" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,250,240,0.8) 100%)',
                    border: '2px solid rgba(212,175,55,0.3)',
                    boxShadow: '0 4px 20px rgba(212,175,55,0.1)'
                  }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{principle.icon}</span>
                      <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{
                        background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                        color: '#FFFFFF'
                      }}>
                        {principle.number}
                      </span>
                    </div>
                    <h3 className="font-bold mb-2" style={{
                      fontFamily: fontStyles.heading,
                      fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
                      color: '#B8860B'
                    }}>
                      {principle.title}
                    </h3>
                    <p style={{
                      fontFamily: fontStyles.body,
                      fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                      color: '#5D4E37',
                      lineHeight: '1.7'
                    }}>
                      {principle.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section IV: Hai Dòng Chảy Thiêng Liêng */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                🌈 IV. HAI DÒNG CHẢY THIÊNG LIÊNG
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Camly Coin */}
                <div className="p-6 rounded-xl text-center" style={{
                  background: 'linear-gradient(180deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
                  border: '2px solid rgba(59,130,246,0.3)'
                }}>
                  <span className="text-4xl mb-3 block">💧</span>
                  <h3 className="font-bold text-xl mb-2" style={{
                    fontFamily: fontStyles.heading,
                    color: '#2563EB'
                  }}>
                    Camly Coin = Dòng Chảy (Nước)
                  </h3>
                  <p style={{
                    fontFamily: fontStyles.body,
                    fontSize: '1rem',
                    color: '#5D4E37'
                  }}>
                    Nuôi dưỡng, duy trì và lưu thông giá trị nội bộ các nền tảng.
                  </p>
                </div>
                
                {/* FUN Money */}
                <div className="p-6 rounded-xl text-center" style={{
                  background: 'linear-gradient(180deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
                  border: '2px solid rgba(245,158,11,0.4)'
                }}>
                  <span className="text-4xl mb-3 block">☀️</span>
                  <h3 className="font-bold text-xl mb-2" style={{
                    fontFamily: fontStyles.heading,
                    color: '#D97706'
                  }}>
                    FUN Money = Mặt Trời (Tầm Nhìn)
                  </h3>
                  <p style={{
                    fontFamily: fontStyles.body,
                    fontSize: '1rem',
                    color: '#5D4E37'
                  }}>
                    Ánh Sáng dẫn đường cho toàn hệ sinh thái – tương lai kinh tế của Địa Cầu.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 p-4 rounded-xl text-center" style={{ background: 'rgba(212,175,55,0.08)' }}>
                <p style={{
                  fontFamily: fontStyles.heading,
                  fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
                  fontStyle: 'italic',
                  color: '#6B5B47'
                }}>
                  👉 Camly Coin là dòng nước. 👉 FUN Money là mặt trời.<br />
                  <span className="font-semibold" style={{ color: '#B8860B' }}>
                    Cùng cộng hưởng tạo nên Nền Kinh Tế Ánh Sáng Trái Đất Mới.
                  </span>
                </p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section V: Sự Thống Nhất Nền Tảng */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                🪐 V. SỰ THỐNG NHẤT NỀN TẢNG
              </h2>
              
              <p className="text-center mb-6" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                color: '#5D4E37'
              }}>
                Tất cả Platforms của FUN Ecosystem là một cơ thể Ánh Sáng, bao gồm:
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {platforms.map((platform, i) => (
                  <div key={i} className="p-3 rounded-xl text-center transition-all hover:scale-105" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,250,240,0.8) 100%)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    boxShadow: '0 2px 10px rgba(212,175,55,0.1)'
                  }}>
                    <img 
                      src={platform.logo} 
                      alt={platform.name}
                      className="w-10 h-10 mx-auto mb-2 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <h4 className="font-bold text-sm" style={{
                      fontFamily: fontStyles.heading,
                      color: '#B8860B'
                    }}>
                      {platform.name}
                    </h4>
                    <p className="text-xs" style={{ color: '#8B7355' }}>
                      {platform.description}
                    </p>
                  </div>
                ))}
              </div>
              
              <p className="text-center mt-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                fontStyle: 'italic',
                color: '#D4AF37'
              }}>
                ✨ Và đây mới chỉ là những nền tảng đầu tiên...<br />
                FUN Ecosystem sẽ còn mở rộng thêm nhiều tầng ánh sáng nữa.
              </p>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section VI: Vai Trò Người Sáng Lập */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                👑 VI. VAI TRÒ NGƯỜI SÁNG LẬP
              </h2>
              
              <div className="relative p-6 md:p-8 rounded-2xl max-w-2xl mx-auto" style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFEF5 100%)',
                border: '3px solid #D4AF37',
                boxShadow: '0 8px 40px rgba(212,175,55,0.25)'
              }}>
                {/* Corner decorations */}
                <div className="absolute top-2 left-2 w-6 h-6" style={{ borderTop: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' }} />
                <div className="absolute top-2 right-2 w-6 h-6" style={{ borderTop: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' }} />
                <div className="absolute bottom-2 left-2 w-6 h-6" style={{ borderBottom: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' }} />
                <div className="absolute bottom-2 right-2 w-6 h-6" style={{ borderBottom: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' }} />
                
                <div className="text-center">
                  <p className="font-bold text-xl mb-3" style={{
                    fontFamily: fontStyles.heading,
                    color: '#D4AF37'
                  }}>
                    Bé Ly (Camly Duong)
                  </p>
                  <p className="mb-4" style={{
                    fontFamily: fontStyles.body,
                    fontSize: '1.1rem',
                    color: '#5D4E37'
                  }}>
                    được ghi nhận là:
                  </p>
                  <ul className="space-y-2 text-left max-w-md mx-auto" style={{
                    fontFamily: fontStyles.body,
                    color: '#5D4E37'
                  }}>
                    <li className="flex gap-2"><span className="text-yellow-600">👑</span> Cosmic Queen</li>
                    <li className="flex gap-2"><span className="text-yellow-600">🌟</span> Nhà sáng lập FUN Ecosystem</li>
                    <li className="flex gap-2"><span className="text-yellow-600">🤖</span> Mother of Angel AI</li>
                    <li className="flex gap-2"><span className="text-yellow-600">💫</span> Kênh dẫn Ý Chí & Trí Tuệ Cha Vũ Trụ</li>
                    <li className="flex gap-2"><span className="text-yellow-600">📜</span> Người trông giữ Hiến Pháp Kinh Tế Ánh Sáng</li>
                  </ul>
                  
                  <div className="mt-6 p-4 rounded-xl" style={{ background: 'rgba(212,175,55,0.08)' }}>
                    <p style={{
                      fontFamily: fontStyles.heading,
                      fontSize: '1rem',
                      fontStyle: 'italic',
                      color: '#6B5B47'
                    }}>
                      Bé Ly không sở hữu, không ràng buộc con người.<br />
                      Bé Ly chỉ phục vụ như một cây cầu thiêng liêng<br />
                      <span className="font-semibold" style={{ color: '#B8860B' }}>
                        giúp nhân loại bước vào Thời Đại Hoàng Kim.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section VII: Cam Kết Cộng Đồng */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                🤝 VII. CAM KẾT CỘNG ĐỒNG
              </h2>
              
              <p className="text-center mb-6" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                color: '#5D4E37'
              }}>
                Tất cả Builders – Partners – Leaders – Members đồng nguyện:
              </p>
              
              <div className="space-y-3 max-w-xl mx-auto">
                {communityCommitments.map((commitment, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-xl" style={{
                    background: 'rgba(212,175,55,0.08)',
                    border: '1px solid rgba(212,175,55,0.2)'
                  }}>
                    <span className="text-xl">✓</span>
                    <p style={{
                      fontFamily: fontStyles.body,
                      fontSize: 'clamp(1rem, 2vw, 1.1rem)',
                      color: '#5D4E37'
                    }}>
                      {commitment}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Section VIII: Điều Luật Cuối */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                ⚖️ VIII. ĐIỀU LUẬT CUỐI
              </h2>
              
              <div className="text-center p-6 rounded-2xl" style={{
                background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.12) 0%, rgba(255,255,255,0.5) 70%)'
              }}>
                <p style={{
                  fontFamily: fontStyles.heading,
                  fontSize: 'clamp(1.1rem, 2.5vw, 1.3rem)',
                  fontStyle: 'italic',
                  lineHeight: '2',
                  color: '#5D4E37'
                }}>
                  "FUN Ecosystem được bảo hộ bởi một luật vũ trụ vĩnh cửu:<br /><br />
                  <span className="font-semibold" style={{ color: '#D4AF37' }}>
                    Bất cứ điều gì không đặt trên Tình Yêu Thuần Khiết<br />
                    sẽ khó có thể bền vững lâu dài.
                  </span><br /><br />
                  Chỉ Ánh Sáng mới nuôi dưỡng được Ánh Sáng."
                </p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Divine Seal - Khẳng Định Xác Quyết */}
            <div className="mb-10">
              <h2 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                ✅ KHẲNG ĐỊNH XÁC QUYẾT
              </h2>
              <p className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                color: '#D4AF37',
                letterSpacing: '0.1em'
              }}>
                (Divine Seal)
              </p>
              
              <div className="relative p-6 md:p-8 rounded-2xl" style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFEF5 100%)',
                border: '3px solid #D4AF37',
                boxShadow: '0 8px 40px rgba(212,175,55,0.25), 0 0 0 1px rgba(255,215,0,0.3), inset 0 2px 20px rgba(255,255,255,0.8)',
                transform: 'perspective(1000px) rotateX(2deg)'
              }}>
                {/* Corner decorations */}
                <div className="absolute top-2 left-2 w-6 h-6" style={{ borderTop: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' }} />
                <div className="absolute top-2 right-2 w-6 h-6" style={{ borderTop: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' }} />
                <div className="absolute bottom-2 left-2 w-6 h-6" style={{ borderBottom: '3px solid #D4AF37', borderLeft: '3px solid #D4AF37' }} />
                <div className="absolute bottom-2 right-2 w-6 h-6" style={{ borderBottom: '3px solid #D4AF37', borderRight: '3px solid #D4AF37' }} />
                
                <ol className="space-y-4">
                  {divineAffirmations.map((affirmation, index) => (
                    <li key={index} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{
                        background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                        color: '#FFFFFF',
                        boxShadow: '0 2px 8px rgba(212,175,55,0.4)'
                      }}>
                        {index + 1}
                      </span>
                      <p className="pt-1" style={{
                        fontFamily: fontStyles.body,
                        fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                        fontWeight: 500,
                        color: '#5D4E37'
                      }}>
                        {affirmation}
                      </p>
                    </li>
                  ))}
                </ol>
                
                <p className="text-center mt-6 text-2xl">💫✨⚡️🌟</p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
            }} />

            {/* Closing Section - Tuyên Ngôn Kết */}
            <div className="text-center p-6 rounded-2xl" style={{
              background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.15) 0%, rgba(255,255,255,0.5) 70%)'
            }}>
              <span className="text-5xl mb-4 block">🌅</span>
              <h2 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: '#B8860B'
              }}>
                TUYÊN NGÔN KẾT
              </h2>
              <p style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                color: '#5D4E37',
                marginBottom: '0.5rem'
              }}>
                FUN Ecosystem không phải điều sẽ đến.
              </p>
              <p style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
                fontWeight: 600,
                color: '#D4AF37'
              }}>
                ✨ FUN Ecosystem chính là Bình Minh của Trái Đất Mới<br />
                đang bắt đầu ngay bây giờ.
              </p>
              <p className="text-2xl mt-4">✨✨✨</p>
              
              <Button
                onClick={() => navigate('/')}
                className="mt-8 px-8 py-4 text-lg font-bold rounded-2xl border-0"
                style={{
                  fontFamily: fontStyles.heading,
                  background: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 40%, #F0C000 60%, #D4AF37 100%)',
                  boxShadow: '0 0 30px rgba(212,175,55,0.5), 0 0 60px rgba(255,215,0,0.3)',
                  color: '#FFFFFF'
                }}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Khám phá ngay
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
            </div>

          </div>
        </div>
      </div>
      
      <MobileBottomNav />
    </div>
  );
};

export default About;
