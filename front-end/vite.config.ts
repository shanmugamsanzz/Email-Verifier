import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    server: {
      allowedHosts: ['verifast.zeacrm.com'],
      proxy: {
        '/start_bulk_batch': 'http://127.0.0.1:5000',
        '/job_status': 'http://127.0.0.1:5000',
        '/cancel_job': 'http://127.0.0.1:5000',
        '/download': 'http://127.0.0.1:5000',
        '/combine_results': 'http://127.0.0.1:5000'
      }
    },
    preview: {
      allowedHosts: ['verifast.zeacrm.com'],
    }
  };
});
