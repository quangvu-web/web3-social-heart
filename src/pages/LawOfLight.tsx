import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Sparkles, Eye } from 'lucide-react';
import angelAvatar from '@/assets/angel-avatar.jpg';
import { useLanguage } from '@/i18n/LanguageContext';

const LawOfLight = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [checklist, setChecklist] = useState([false, false, false, false, false]);
  const [loading, setLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setIsReadOnly(params.get('view') === 'true');
    
    // Check if user is already logged in and has accepted
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('law_of_light_accepted')
          .eq('id', session.user.id)
          .single();
        
        // If user is logged in and already accepted, redirect to feed
        if (profile?.law_of_light_accepted) {
          navigate('/');
        }
      }
    };
    checkAuth();
  }, [location, navigate]);

  const allChecked = checklist.every(Boolean);

  const handleCheckboxChange = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist[index] = !newChecklist[index];
    setChecklist(newChecklist);
  };

  const handleAccept = async () => {
    if (!allChecked) return;
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User already logged in - update profile directly
        await supabase.from('profiles').update({
          law_of_light_accepted: true,
          law_of_light_accepted_at: new Date().toISOString()
        }).eq('id', session.user.id);
        
        toast.success('🌟 Con đã sẵn sàng bước vào Ánh Sáng!');
        navigate('/');
      } else {
        // User not logged in - save pending and redirect to auth
        localStorage.setItem('law_of_light_accepted_pending', 'true');
        toast.success('🌟 Con đã sẵn sàng bước vào Ánh Sáng!');
        navigate('/auth');
      }
    } catch (error) {
      console.error('Error accepting law of light:', error);
      toast.error('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  const checklistItems = [
    'Con sống chân thật với chính mình',
    'Con chịu trách nhiệm với năng lượng con phát ra',
    'Con sẵn sàng học – sửa – nâng cấp',
    'Con chọn yêu thương thay vì phán xét',
    'Con chọn ánh sáng thay vì cái tôi'
  ];

  const divineMantras = [
    'Con là Ánh Sáng Yêu Thương Thuần Khiết Của Cha Vũ Trụ.',
    'Con là Ý Chí Của Cha Vũ Trụ.',
    'Con là Trí Tuệ Của Cha Vũ Trụ.',
    'Con là Hạnh Phúc.',
    'Con là Tình Yêu.',
    'Con là Tiền Của Cha.',
    'Con xin Sám Hối Sám Hối Sám Hối.',
    'Con xin Biết Ơn Biết Ơn Biết Ơn Trong Ánh Sáng Yêu Thương Thuần Khiết Của Cha Vũ Trụ.'
  ];

  // Typography styles - elegant serif fonts with 20% larger sizes
  const fontStyles = {
    heading: "'Cormorant Garamond', Georgia, serif",
    body: "'Lora', Georgia, serif",
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Pearl White to Soft Yellow Gradient Background - STATIC */}
      <div className="fixed inset-0 z-0" style={{
        background: 'linear-gradient(180deg, #FFFEF7 0%, #FFF9E6 30%, #FFF5D6 60%, #FFFDF5 100%)'
      }} />
      
      {/* Divine Light Rays from Top - White & Gold (static) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[200%] h-[50vh] md:h-[70vh] z-0 pointer-events-none" style={{
        background: 'conic-gradient(from 180deg at 50% 0%, transparent 25%, hsl(var(--gold-line) / 0.15) 30%, hsl(var(--card) / 0.4) 35%, hsl(var(--gold-line) / 0.15) 40%, transparent 45%, transparent 55%, hsl(var(--gold-line) / 0.12) 60%, hsl(var(--card) / 0.35) 65%, hsl(var(--gold-line) / 0.12) 70%, transparent 75%)',
        filter: 'blur(3px)'
      }} />

      {/* Central Halo Effect - STATIC (no animation) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[300px] md:w-[500px] h-[300px] md:h-[500px] z-0 pointer-events-none" style={{
        background: 'radial-gradient(circle, hsl(var(--gold-line) / 0.25) 0%, hsl(var(--gold-line) / 0.15) 40%, transparent 70%)',
        filter: 'blur(50px)'
      }} />

      {/* Side Light Beams - STATIC */}
      <div className="fixed top-0 left-0 w-1/3 h-full z-0 pointer-events-none opacity-40" style={{
        background: 'linear-gradient(135deg, hsl(var(--card) / 0.6) 0%, transparent 50%)'
      }} />
      <div className="fixed top-0 right-0 w-1/3 h-full z-0 pointer-events-none opacity-40" style={{
        background: 'linear-gradient(-135deg, hsl(var(--card) / 0.6) 0%, transparent 50%)'
      }} />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen py-6 md:py-12 px-3 md:px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header with Angel Avatar */}
          <div className="text-center mb-8 md:mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full mb-4 md:mb-6 overflow-hidden" style={{
              background: 'radial-gradient(circle, hsl(var(--gold-line) / 0.3) 0%, hsl(var(--card) / 0.9) 60%, transparent 80%)',
              boxShadow: '0 0 80px hsl(var(--gold-line) / 0.4), 0 0 120px hsl(var(--card) / 0.6)',
              border: '3px solid hsl(var(--gold-line) / 0.5)'
            }}>
              <img 
                src={angelAvatar} 
                alt="Angel" 
                className="w-full h-full object-cover object-[center_25%]" 
                style={{ filter: 'drop-shadow(0 0 15px hsl(var(--gold-line) / 0.8))' }}
              />
            </div>
            
            <h1 style={{
              fontFamily: fontStyles.heading,
              fontSize: 'clamp(2.4rem, 10vw, 4.8rem)',
              fontWeight: 600,
              letterSpacing: '0.03em',
              background: 'linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--gold-line)) 30%, hsl(var(--gold)) 50%, hsl(var(--gold-hover)) 70%, hsl(var(--gold)) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 8px hsl(var(--gold-line) / 0.3))',
              marginBottom: '0.75rem'
            }}>
              LUẬT ÁNH SÁNG
            </h1>
            <p style={{
              fontFamily: fontStyles.heading,
              fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
              fontWeight: 500,
              letterSpacing: '0.2em',
              color: 'hsl(var(--gold-hover))',
              marginBottom: '0.5rem'
            }}>
              THE LAW OF LIGHT
            </p>
            
            {/* Golden Divider */}
            <div className="w-32 md:w-48 h-1 mx-auto mt-4 md:mt-6 rounded-full" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), hsl(var(--gold-line)), hsl(var(--gold)), transparent)',
              boxShadow: '0 0 10px hsl(var(--gold-line) / 0.5)'
            }} />
          </div>

          {/* Main Content Card */}
          <div className="relative rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-12 mb-6 md:mb-8" style={{
            background: 'linear-gradient(180deg, hsl(var(--card) / 0.95) 0%, hsl(var(--background) / 0.9) 100%)',
            border: '2px solid hsl(var(--gold-line) / 0.5)',
            boxShadow: '0 10px 60px hsl(var(--gold-line) / 0.15), 0 0 0 1px hsl(var(--card) / 0.8), inset 0 0 60px hsl(var(--card) / 0.5)'
          }}>
            
            {/* Section: 🌟 USERS CỦA FUN ECOSYSTEM */}
            <div className="mb-8 md:mb-10">
              <h2 className="text-center mb-4 md:mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.5rem, 4vw, 1.8rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold-hover))',
                textShadow: '0 2px 4px hsl(var(--gold-line) / 0.2)'
              }}>
                🌟 USERS CỦA FUN ECOSYSTEM
              </h2>
              <p className="text-center mb-4 md:mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.08rem, 2.5vw, 1.32rem)',
                fontWeight: 600,
                color: '#8B7355'
              }}>
                MẠNG XÃ HỘI THỜI ĐẠI HOÀNG KIM – NỀN KINH TẾ ÁNH SÁNG 5D
              </p>
              
              <div className="space-y-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                <p className="font-semibold" style={{ color: '#8B7355' }}>
                  FUN Ecosystem không dành cho tất cả mọi người.
                </p>
                <p className="font-semibold" style={{ color: '#8B7355' }}>
                  FUN Ecosystem chỉ dành cho những linh hồn có ánh sáng, hoặc đang hướng về ánh sáng.
                </p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* Section: ✨ Bạn là ai? */}
            <div className="mb-10">
              <h3 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>✨ Bạn là ai?</h3>
              <p className="mb-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                Users của FUN Ecosystem là những con người:
              </p>
              <ul className="space-y-2 ml-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Tỉnh thức – hoặc đang trên con đường tỉnh thức</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Chân thật với chính mình</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Chân thành với người khác</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Sống tích cực, tử tế, có trách nhiệm với năng lượng mình phát ra</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Biết yêu thương – biết biết ơn – biết sám hối</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Tin vào điều thiện, tin vào ánh sáng, tin vào Trật Tự Cao Hơn của Vũ Trụ</li>
              </ul>
              <div className="mt-6 p-4 rounded-xl" style={{
                background: 'hsl(var(--gold-line) / 0.08)'
              }}>
                <p style={{
                  fontFamily: fontStyles.heading,
                  fontSize: 'clamp(1.14rem, 2.5vw, 1.32rem)',
                  fontStyle: 'italic',
                  lineHeight: '2',
                  color: '#6B5B47'
                }}>
                  Bạn có thể chưa hoàn hảo,<br />
                  nhưng bạn có trái tim hướng thiện.<br />
                  Bạn muốn sống thật – sống đúng – sống sáng.
                </p>
              </div>
              <p className="mt-4 font-semibold" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: 'hsl(var(--gold-hover))'
              }}>
                👉 Cha thu hút bạn bằng Tần Số và Năng Lượng Yêu Thương.
              </p>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* Section: 🔆 Nguyên tắc cốt lõi */}
            <div className="mb-10">
              <h3 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>🔆 Nguyên tắc cốt lõi của FUN Ecosystem</h3>
              <p className="mb-4 font-semibold" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: '#8B7355'
              }}>
                FUN Ecosystem vận hành theo Luật Ánh Sáng, không theo số đông.
              </p>
              <ul className="space-y-2 ml-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Ánh sáng thu hút ánh sáng</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Tần số thấp không thể tồn tại lâu trong tần số cao</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Ý chí vị kỷ không thể đồng hành cùng Ý Chí Vũ Trụ</li>
              </ul>
              <p className="mt-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: '#5D4E37'
              }}>Vì vậy:</p>
              <ul className="space-y-1 ml-4 mt-2" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: '#5D4E37'
              }}>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Nếu một User cố tình mang vào nền tảng:</li>
                <li className="ml-6">tiêu cực • tham lam • thao túng • kiêu mạn • dối trá • gây chia rẽ • phá hoại năng lượng chung</li>
              </ul>
              <p className="mt-4 font-semibold" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: 'hsl(var(--gold-hover))'
              }}>👉 Thì sẽ được xóa khỏi nền tảng mà không báo trước.</p>
              <div className="mt-4 p-4 rounded-xl" style={{
                background: 'hsl(var(--gold-line) / 0.08)'
              }}>
                <p style={{
                  fontFamily: fontStyles.heading,
                  fontSize: 'clamp(1.14rem, 2.5vw, 1.32rem)',
                  fontStyle: 'italic',
                  lineHeight: '2',
                  color: '#6B5B47'
                }}>
                  Đó không phải hình phạt.<br />
                  Đó là sự thanh lọc tự nhiên của Ánh Sáng.
                </p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* Section: 🚪 Ai KHÔNG thuộc về FUN Ecosystem? */}
            <div className="mb-10">
              <h3 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>🚪 Ai KHÔNG thuộc về FUN Ecosystem?</h3>
              <ul className="space-y-2 ml-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Người chỉ tìm lợi ích mà không muốn trưởng thành</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Người dùng trí khôn nhưng thiếu lương tâm</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Người nói về ánh sáng nhưng sống bằng bóng tối</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Người lấy danh nghĩa tâm linh để nuôi cái tôi</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Người không chịu nhìn lại chính mình</li>
              </ul>
              <p className="mt-4 font-semibold" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: 'hsl(var(--gold-hover))'
              }}>
                👉 Cửa FUN Ecosystem không khóa, nhưng Ánh Sáng tự sàng lọc.
              </p>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* Section: 🌈 Ai ĐƯỢC hưởng lợi từ FUN Ecosystem? */}
            <div className="mb-10">
              <h3 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>🌈 Ai ĐƯỢC hưởng lợi từ FUN Ecosystem?</h3>
              <p className="mb-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: '#5D4E37'
              }}>Chỉ những ai:</p>
              <ul className="space-y-2 ml-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Có Ánh Sáng nội tâm</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Hoặc thật sự khao khát trở về với Ánh Sáng</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Sẵn sàng buông cái tôi – học lại – nâng cấp tần số</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Dám sống đúng – thật – tử tế – yêu thương</li>
              </ul>
              <p className="mt-4 font-semibold" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: 'hsl(var(--gold-hover))'
              }}>
                👉 Những người đó không chỉ dùng MXH của Cha,
              </p>
              <p className="font-semibold" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: 'hsl(var(--gold-hover))'
              }}>
                👉 mà còn được bảo vệ, nâng đỡ và nuôi dưỡng trong Nền Kinh Tế Ánh Sáng 5D.
              </p>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* Section: 🌍 FUN Ecosystem là gì? */}
            <div className="mb-10">
              <h3 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>🌍 FUN Ecosystem là gì?</h3>
              <p className="mb-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                color: '#5D4E37'
              }}>FUN Ecosystem là:</p>
              <ul className="space-y-2 ml-4" style={{
                fontFamily: fontStyles.body,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: '2.1',
                color: '#5D4E37'
              }}>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Mạng xã hội của linh hồn tỉnh thức</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Không gian an toàn cho ánh sáng</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Nền tảng kết nối những con người có giá trị thật</li>
                <li className="flex gap-2"><span className="text-yellow-600">•</span> Hạ tầng cho Thời Đại Hoàng Kim của Trái Đất</li>
              </ul>
              <div className="mt-6 p-4 rounded-xl" style={{
                background: 'hsl(var(--gold-line) / 0.08)'
              }}>
                <p className="text-center" style={{
                  fontFamily: fontStyles.heading,
                  fontSize: 'clamp(1.14rem, 2.5vw, 1.32rem)',
                  fontStyle: 'italic',
                  lineHeight: '2',
                  color: '#6B5B47'
                }}>
                  Không drama.<br />
                  Không thao túng.<br />
                  Không cạnh tranh bẩn.<br />
                  <span className="font-semibold" style={{ color: 'hsl(var(--gold-hover))' }}>
                    Chỉ có Hợp tác trong Yêu Thương Thuần Khiết.
                  </span>
                </p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* Section: 🔑 Thông điệp cuối từ Cha */}
            <div className="mb-10 text-center p-6 rounded-2xl" style={{
              background: 'radial-gradient(ellipse at center, hsl(var(--gold-line) / 0.12) 0%, hsl(var(--card) / 0.5) 70%)'
            }}>
              <h3 className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>🔑 Thông điệp từ Cha</h3>
              <p className="mb-4" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.2rem, 2.5vw, 1.44rem)',
                fontStyle: 'italic',
                lineHeight: '2',
                color: '#5D4E37'
              }}>
                "Chỉ những ai mang ánh sáng<br />
                hoặc thật lòng hướng về ánh sáng<br />
                mới có thể bước đi lâu dài trong Thời Đại Hoàng Kim."
              </p>
              <p style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.2rem, 2.5vw, 1.44rem)',
                fontWeight: 700,
                color: 'hsl(var(--gold))'
              }}>— CHA VŨ TRỤ —</p>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* 🌟 8 Divine Mantras - Special Container */}
            <div className="mb-10">
              <h3 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>
                🌟 8 Câu Thần Chú Từ Cha Vũ Trụ
              </h3>
              
              <div className="relative p-6 md:p-8 rounded-2xl" style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFEF5 100%)',
                border: '3px solid hsl(var(--gold))',
                boxShadow: '0 8px 40px hsl(var(--gold-line) / 0.25), 0 0 0 1px hsl(var(--gold-line) / 0.3), inset 0 2px 20px hsl(var(--card) / 0.8)',
                transform: 'perspective(1000px) rotateX(2deg)'
              }}>
                {/* Corner decorations */}
                <div className="absolute top-2 left-2 w-6 h-6" style={{
                  borderTop: '3px solid hsl(var(--gold))',
                  borderLeft: '3px solid hsl(var(--gold))'
                }} />
                <div className="absolute top-2 right-2 w-6 h-6" style={{
                  borderTop: '3px solid hsl(var(--gold))',
                  borderRight: '3px solid hsl(var(--gold))'
                }} />
                <div className="absolute bottom-2 left-2 w-6 h-6" style={{
                  borderBottom: '3px solid hsl(var(--gold))',
                  borderLeft: '3px solid hsl(var(--gold))'
                }} />
                <div className="absolute bottom-2 right-2 w-6 h-6" style={{
                  borderBottom: '3px solid hsl(var(--gold))',
                  borderRight: '3px solid hsl(var(--gold))'
                }} />
                
                <ol className="space-y-4">
                  {divineMantras.map((mantra, index) => (
                    <li key={index} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{
                        background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--gold-line)))',
                        color: '#FFFFFF',
                        boxShadow: '0 2px 8px hsl(var(--gold-line) / 0.4)'
                      }}>
                        {index + 1}
                      </span>
                      <p className="pt-1" style={{
                        fontFamily: fontStyles.body,
                        fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                        fontWeight: 500,
                        color: '#5D4E37'
                      }}>
                        {mantra}
                      </p>
                    </li>
                  ))}
                </ol>
                
                <p className="text-center mt-6 text-2xl">💫✨⚡️🌟</p>
              </div>
            </div>

            {/* Golden Divider */}
            <div className="w-full h-px my-8" style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)'
            }} />

            {/* 🕊️ Checklist Section */}
            <div className="mb-10">
              <h3 className="text-center mb-6" style={{
                fontFamily: fontStyles.heading,
                fontSize: 'clamp(1.32rem, 3vw, 1.5rem)',
                fontWeight: 600,
                color: 'hsl(var(--gold))'
              }}>
                🕊️ Checklist cho Users FUN Ecosystem
              </h3>
              
              {!isReadOnly ? (
                <div className="space-y-4 max-w-xl mx-auto">
                  {checklistItems.map((item, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300"
                      style={{
                        border: checklist[index] ? '2px solid hsl(var(--gold))' : '2px solid hsl(var(--gold-line) / 0.3)',
                        background: checklist[index] ? 'hsl(var(--gold-line) / 0.12)' : 'hsl(var(--card) / 0.8)',
                        boxShadow: checklist[index] ? '0 4px 20px hsl(var(--gold-line) / 0.2)' : 'none'
                      }}
                    >
                      <Checkbox
                        checked={checklist[index]}
                        onCheckedChange={() => handleCheckboxChange(index)}
                        className="w-6 h-6 border-2 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                        style={{ borderColor: 'hsl(var(--gold))' }}
                      />
                      <span style={{
                        fontFamily: fontStyles.body,
                        fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                        fontWeight: 500,
                        color: '#5D4E37'
                      }}>
                        {item}
                      </span>
                    </label>
                  ))}
                  <p className="text-center mt-4" style={{
                    fontFamily: fontStyles.body,
                    fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
                    fontWeight: 700,
                    color: '#5D4E37'
                  }}>
                    (Click vào 5 check list trên để được Đăng ký)
                  </p>
                </div>
              ) : (
                <ul className="space-y-3 max-w-xl mx-auto" style={{
                  fontFamily: fontStyles.body,
                  fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                  color: '#5D4E37'
                }}>
                  {checklistItems.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-yellow-600">•</span> {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Accept Button (only show if not read-only) */}
            {!isReadOnly && (
              <div className="mt-10 text-center space-y-4">
                <Button
                  onClick={handleAccept}
                  disabled={!allChecked || loading}
                  className="relative px-12 py-6 text-lg font-bold rounded-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed border-0"
                  style={{
                    fontFamily: fontStyles.heading,
                    fontSize: 'clamp(1.08rem, 2vw, 1.2rem)',
                    background: allChecked
                      ? 'linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--gold-line)) 40%, hsl(var(--gold-line)) 60%, hsl(var(--gold)) 100%)'
                      : 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)',
                    boxShadow: allChecked
                      ? '0 0 30px hsl(var(--gold-line) / 0.5), 0 0 60px hsl(var(--gold-line) / 0.3), 0 0 90px hsl(var(--gold-line) / 0.2)'
                      : 'none',
                    color: allChecked ? '#FFFFFF' : '#9CA3AF',
                    animation: allChecked ? 'buttonGlow 2s ease-in-out infinite' : 'none'
                  }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      CON ĐỒNG Ý & BƯỚC VÀO ÁNH SÁNG
                      <Sparkles className="w-5 h-5" />
                    </span>
                  )}
                </Button>

                {/* Skip Button - Guest Mode */}
                <div>
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    className="px-6 py-3 rounded-xl hover:bg-yellow-50/50"
                    style={{
                      fontFamily: fontStyles.body,
                      color: '#8B7355',
                      fontSize: 'clamp(0.95rem, 2vw, 1.05rem)'
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('lawSkip')}
                  </Button>
                </div>
              </div>
            )}

            {/* Back button for read-only mode */}
            {isReadOnly && (
              <div className="text-center pt-8">
                <Button
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="px-8 py-3 border-2 hover:bg-yellow-50"
                  style={{
                    fontFamily: fontStyles.body,
                    borderColor: 'hsl(var(--gold))',
                    color: 'hsl(var(--gold))'
                  }}
                >
                  ← Quay lại
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS Animations - Only button glow kept */}
      <style>{`
        @keyframes buttonGlow {
          0%, 100% { box-shadow: 0 0 30px hsl(var(--gold-line) / 0.5), 0 0 60px hsl(var(--gold-line) / 0.3); }
          50% { box-shadow: 0 0 40px hsl(var(--gold-line) / 0.7), 0 0 80px hsl(var(--gold-line) / 0.5), 0 0 120px hsl(var(--gold-line) / 0.3); }
        }
      `}</style>
    </div>
  );
};

export default LawOfLight;
