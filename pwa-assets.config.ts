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
      resizeOptions: { background: '#0b6b62' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.2,
      resizeOptions: { background: '#0b6b62' },
    },
  },
  images: ['public/logo.svg'],
});
