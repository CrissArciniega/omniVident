#!/bin/bash
# ============================================================
# OmniVident - Setup del servidor KVM8 (Ubuntu)
# ============================================================
# Ejecutar como root en el servidor:
#   chmod +x setup-server.sh && ./setup-server.sh
# ============================================================

set -e

echo "=========================================="
echo " OmniVident - Configuracion del servidor"
echo "=========================================="

# 1. Actualizar el sistema
echo "[1/6] Actualizando sistema..."
apt-get update && apt-get upgrade -y

# 2. Instalar Docker
echo "[2/6] Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker instalado correctamente"
else
    echo "Docker ya esta instalado"
fi

# 3. Instalar Docker Compose (viene incluido en versiones recientes)
echo "[3/6] Verificando Docker Compose..."
docker compose version || {
    echo "Instalando Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
}

# 4. Instalar Nginx
echo "[4/6] Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# 5. Instalar Certbot (para SSL gratis con Let's Encrypt)
echo "[5/6] Instalando Certbot (SSL)..."
apt-get install -y certbot python3-certbot-nginx

# 6. Crear directorio del proyecto
echo "[6/6] Creando directorio del proyecto..."
mkdir -p /opt/omnivident

echo ""
echo "=========================================="
echo " Setup completado!"
echo "=========================================="
echo " Docker: $(docker --version)"
echo " Nginx:  $(nginx -v 2>&1)"
echo " Certbot: $(certbot --version 2>&1)"
echo ""
echo " Siguiente paso: sube el proyecto a /opt/omnivident/"
echo "=========================================="
