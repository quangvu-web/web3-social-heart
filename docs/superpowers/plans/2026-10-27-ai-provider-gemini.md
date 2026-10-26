# Provider Gemini — Giai đoạn 1

Spec: yêu cầu chủ dự án trong hội thoại ngày27/10/2026 MYT. Thực hiện trực tiếp theo phương án đã chốt: Gateway mặc định/fallback, chỉ caption-translate được direct, không mở giai đoạn2.

Bước0 đạt: key có trong runtime (không xuất giá trị); flagai.provider chưa tồn tại; Google catalog200; model `models/gemini-3.1-flash-lite` POST OpenAI-completions200,nonempty choices content,1377ms. Map duy nhất từ Gateway `google/gemini-3.1-flash-lite`. Các model khác không tự stripgoogle/ hay đoán map.

- [ ] Test RED→GREEN routing thật ở network boundary: mặc địnhGateway, flaggemini chỉcaption-translate, labelkhác/image_url vẫnGateway, thiếukey/unmapped/auth/429/5xx/timeout vềGateway, retry và body ban đầu nguyên vẹn, key không xuất logs.
- [ ] Extend getFlag kiểu provider qua enabled + meta.value, cache60s như cũ; khôngrow/invalid=>lovable; lỗiđọc mới fallbackAI_PROVIDER. Booleanflags hiện hành giữ hợp đồng.
- [ ] Provider routing tập trung callAiGateway; direct mỗi retry giữ opts cũ, exhausted vềGateway cùng body/modelGateway gốc. Logprovider/model/label mọi call; không log direct errorbody/key.
- [ ] Metadata usage theo context async riêng mỗi request để không lẫn provider giữa các request; giữ số event/hành vi tracker hiện có, thêm provider/ai_providers khi có AI calls. Không sửa từngcaller.
- [ ] Edge/sharedtests, captionregressions,frontend/build, review,commit/pushPR. Deploy chỉangel-caption choGiai đoạn1; giữnhãnkhácGateway. Nghiệmthu live khi cóphiên đangchạy, không gọi mock làlive. Keymissing/429 giảlập chỉtrongtest. Khôngmigration/ảnh/OCR/authchange.

Đã phát hiện một số callertext dùngfetch trực tiếp (angel-core); giữGateway theo phạmviGiai đoạn1, không tuyênbố đãmigrate mọiAIcaller. Cần mô tả rõ default vs readfailure và các calls direct không còn xuất hiện trên AIactivityLovable.
