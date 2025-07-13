import type { Config } from '@react-router/dev/config';
import { source } from './src/app/source';
import { vercelPreset } from '@vercel/react-router/vite';

export default {
  ssr: true,
  async prerender({ getStaticPaths }) {
    return [...getStaticPaths(), ...source.getPages().map((page) => page.url)];
  },
  appDirectory: 'src/app',
  presets: [vercelPreset()],
} satisfies Config;
