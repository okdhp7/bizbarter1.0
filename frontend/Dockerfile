# ---------- 개발용 (docker compose 기본: 소스 마운트 + Vite HMR) ----------
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3500
CMD ["npm", "run", "dev"]

# ---------- 운영용 빌드 ----------
FROM dev AS build
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
