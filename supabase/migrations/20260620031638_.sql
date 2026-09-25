
ALTER TABLE public.telegram_community_blocked_keywords
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS meaning_en TEXT,
  ADD COLUMN IF NOT EXISTS meaning_vi TEXT,
  ADD COLUMN IF NOT EXISTS risk_note_en TEXT,
  ADD COLUMN IF NOT EXISTS risk_note_vi TEXT;

UPDATE public.telegram_community_blocked_keywords
SET language = COALESCE(language, 'Chinese'),
    meaning_en = COALESCE(meaning_en, 'Earn money daily'),
    meaning_vi = COALESCE(meaning_vi, 'Kiếm tiền mỗi ngày'),
    risk_note_en = COALESCE(risk_note_en, 'Commonly used in spam, scam, fake investment, and get-rich-quick promotions.'),
    risk_note_vi = COALESCE(risk_note_vi, 'Thường dùng trong tin spam, lừa đảo, đầu tư ảo, làm giàu nhanh.')
WHERE keyword = '日赚';
;
