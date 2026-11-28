import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

function getGitVersion(): string {
  try {
    const count = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    if (/^\d+$/.test(count)) {
      return `1.0.${count}`;
    }
  } catch {
    // fallback when git is unavailable
  }
  return '1.0.0';
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getGitVersion()),
  },
  server: {
    port: 5175,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
