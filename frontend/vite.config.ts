import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 로컬(npm run dev)과 Docker 개발 컨테이너 모두에서 사용
//  - API_PROXY_TARGET      : /api 프록시 대상 (Docker: http://backend:8500)
//  - CHOKIDAR_USEPOLLING   : Windows 폴더를 컨테이너에 마운트하면 파일 변경 이벤트가 전달되지 않으므로 polling 사용
//  - VITE_HMR_PORT         : (선택) HMR 포트 강제 지정. 지정하지 않으면 브라우저가 접속한 주소/포트를 그대로 사용
//                            → localhost, 사내 IP, 외부 터널(https) 어디서 접속해도 즉시 반영
//  - VITE_ALLOWED_HOSTS    : (선택) 추가로 허용할 접속 도메인 (쉼표 구분)
const env = process.env

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(env.VITE_PORT || 3500),
    strictPort: true,
    // localhost·IP 는 기본 허용. 외부 테스트용 터널 도메인 추가 허용
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', ...(env.VITE_ALLOWED_HOSTS ? env.VITE_ALLOWED_HOSTS.split(',') : [])],
    watch: env.CHOKIDAR_USEPOLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    hmr: env.VITE_HMR_PORT ? { clientPort: Number(env.VITE_HMR_PORT) } : undefined,
    proxy: {
      '/api': { target: env.API_PROXY_TARGET || 'http://localhost:8500', changeOrigin: true, ws: true },
    },
  },
})
