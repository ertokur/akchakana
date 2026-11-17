import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// PNG-иконки (192, 512, maskable, apple-touch, favicon) генерируются из public/logo.svg:
// npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.25,
      resizeOptions: { background: '#4f46e5' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.2,
      resizeOptions: { background: '#4f46e5' },
    },
  },
  images: ['public/logo.svg'],
});
