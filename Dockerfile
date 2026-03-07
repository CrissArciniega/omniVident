# ============================================================
# OmniVident - Mission Control + Agentes
# ============================================================
# Este contenedor incluye:
#   - Dashboard (Node.js Express + React compilado)
#   - Agente SEO (Python)
#   - Agente Contenido y RRSS (Node.js + Python)
#
# ¿Por que todo junto? Porque el dashboard ejecuta los agentes
# como procesos hijos (child_process.spawn). Necesitan estar
# en el mismo sistema de archivos.
# ============================================================

# --- STAGE 1: Compilar el frontend React ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app/dashboard/client
COPY dashboard/client/package.json dashboard/client/package-lock.json ./
RUN npm ci
COPY dashboard/client/ ./
RUN npm run build


# --- STAGE 2: Servidor de produccion con Node.js + Python ---
FROM node:20-slim

# Instalar Python 3 + pip (necesario para los agentes de IA)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# ─── 1. Dependencias del Dashboard (Node.js) ───
COPY dashboard/package.json dashboard/package-lock.json ./dashboard/
RUN cd dashboard && npm ci --omit=dev

# ─── 2. Dependencias del Agente SEO (Python) ───
COPY ["agente de seo y product hunt/requirements.txt", "/tmp/seo-req.txt"]
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/seo-req.txt \
    && rm /tmp/seo-req.txt

# ─── 3. Dependencias del Agente Contenido (Python + Node.js) ───
COPY ["agente contenido y rrss/requirements.txt", "/tmp/content-req.txt"]
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/content-req.txt \
    && rm /tmp/content-req.txt

COPY ["agente contenido y rrss/package.json", "./agente contenido y rrss/package.json"]
RUN cd "./agente contenido y rrss" && npm install --omit=dev 2>/dev/null; exit 0

# ─── 4. Codigo fuente del Dashboard ───
COPY dashboard/server/ ./dashboard/server/
COPY dashboard/db/ ./dashboard/db/
COPY dashboard/public/ ./dashboard/public/
COPY dashboard/docker-entrypoint.sh ./dashboard/docker-entrypoint.sh
RUN chmod +x ./dashboard/docker-entrypoint.sh

# ─── 5. Frontend compilado (desde Stage 1) ───
COPY --from=frontend-builder /app/dashboard/client/dist ./dashboard/client/dist

# ─── 6. Codigo fuente de los Agentes ───
COPY ["agente de seo y product hunt/", "./agente de seo y product hunt/"]
COPY ["agente contenido y rrss/", "./agente contenido y rrss/"]

# Directorio de trabajo = dashboard (donde vive el server)
WORKDIR /app/dashboard

# Puerto del servidor Express
EXPOSE 3001

# Healthcheck: verifica que el servidor responde
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Iniciar con el script que espera MySQL + seed + servidor
CMD ["sh", "docker-entrypoint.sh"]
