# ==========================================
# Build Stage - Instalación de dependencias
# ==========================================
FROM oven/bun:1.3-alpine AS base

# Variables de entorno de build
ENV NODE_ENV=production

WORKDIR /app

# Copiar solo archivos de dependencias primero (mejor caché de Docker)
COPY package.json bun.lockb* ./

# Instalar dependencias con lockfile congelado
RUN bun install --frozen-lockfile --production

# ==========================================
# Production Stage - Imagen final optimizada
# ==========================================
FROM oven/bun:1.3-alpine

# Variables de entorno
ENV NODE_ENV=production \
  PORT=3000

WORKDIR /app

# Copiar dependencias desde build stage
COPY --from=base /app/node_modules ./node_modules

# Copiar solo archivos necesarios (excluir dev files)
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
  adduser -S bunapp -u 1001 && \
  chown -R bunapp:nodejs /app

# Cambiar a usuario no-root
USER bunapp

# Exponer puerto de la aplicación (solo para la instancia de app)
EXPOSE 3000
