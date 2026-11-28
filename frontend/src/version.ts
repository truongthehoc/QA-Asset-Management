// Phiên bản tự động tính theo số commit Git khi Vite build (không sửa file trên đĩa)
declare const __APP_VERSION__: string;
export const BUILD_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
