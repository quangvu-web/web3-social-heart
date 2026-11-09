/**
 * Quyết định màn hình nào phải hiển thị trong lúc khởi tạo phiên đăng nhập.
 *
 * Quy tắc: lỗi phiên đăng nhập và lỗi tải hồ sơ là HAI chuyện khác nhau và
 * không được báo lẫn nhau.
 * - `fatal`: không xác minh được phiên đăng nhập.
 * - `loading`: còn đang xác minh.
 * - `profile-unavailable`: phiên đăng nhập hợp lệ nhưng hồ sơ chưa tải được.
 *   Không tự cho vào (sẽ bỏ qua bước xác nhận Law of Light) và cũng không được
 *   báo là lỗi phiên đăng nhập.
 * - `ready`: dữ liệu đã đủ để cổng Law of Light tự quyết định.
 */
export type AuthBootstrapState = 'fatal' | 'loading' | 'profile-unavailable' | 'ready';

export interface AuthBootstrapInput {
  isLoading: boolean;
  bootstrapError: unknown;
  profileError: unknown;
  hasSession: boolean;
  hasProfile: boolean;
}

export function resolveAuthBootstrapState(input: AuthBootstrapInput): AuthBootstrapState {
  if (input.bootstrapError) return 'fatal';
  if (input.isLoading) return 'loading';
  if (input.hasSession && !input.hasProfile && input.profileError) return 'profile-unavailable';
  return 'ready';
}
