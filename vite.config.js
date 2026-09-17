import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.open_router_api_key || env.OPENROUTER_API_KEY || '';
  const model = (env.model || env.MODEL || 'nvidia/nemotron-3.5-lightning:free').trim();

  return {
    define: {
      'import.meta.env.OPENROUTER_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.OPENROUTER_MODEL': JSON.stringify(model),
    },
    server: {
      open: true,
      port: 5173,
    },
  };
});
