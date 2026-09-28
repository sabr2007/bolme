import { defineConfig } from '@playwright/test'
import { FACE_VIDEO } from './e2e/faceVideo'

const CAMERA_ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    permissions: ['camera'],
  },
  projects: [
    // Chrome's built-in fake camera: a test pattern without a face
    { name: 'no-face', testMatch: /smoke\.spec\.ts/, use: { launchOptions: { args: CAMERA_ARGS } } },
    // a generated webcam video of a person performing the gestures
    {
      name: 'face',
      testMatch: /face\.spec\.ts/,
      use: { launchOptions: { args: [...CAMERA_ARGS, `--use-file-for-fake-video-capture=${FACE_VIDEO}`] } },
    },
  ],
})
