#!/bin/bash
# ============================================================
# OmniVident - Script de despliegue
# ============================================================
# Ejecutar despues de subir el proyecto a /opt/omnivident/
#   chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

PROJECT_DIR="/opt/omnivident"
DOMAIN="omnivident.megamayorista.net"

echo "=========================================="
echo " OmniVident - Desplegando"
echo "=========================================="

cd "$PROJECT_DIR"

# 1. Configurar Nginx
echo "[1/4] Configurando Nginx..."
cp deploy/nginx-omnivident.conf /etc/nginx/sites-available/omnivident
ln -sf /etc/nginx/sites-available/omnivident /etc/nginx/sites-enabled/omnivident

# Verificar que la config de Nginx es valida
nginx -t
systemctl reload nginx
echo "Nginx configurado para $DOMAIN"

# 2. Construir y levantar Docker
echo "[2/4] Construyendo y levantando contenedores..."
docker compose --env-file .env.docker up -d --build

# 3. Esperar a que la app este lista
echo "[3/4] Esperando a que la app arranque..."
sleep 15

# Verificar que responde
if curl -s http://127.0.0.1:3001/api/health | grep -q "ok"; then
    echo "App respondiendo correctamente!"
else
    echo "ADVERTENCIA: La app no responde aun. Revisa los logs:"
    echo "  docker compose logs -f app"
fi

# 4. Configurar SSL con Let's Encrypt
echo "[4/4] Configurando SSL (HTTPS)..."
echo "Ejecuta el siguiente comando para obtener el certificado SSL:"
echo ""
echo "  certbot --nginx -d $DOMAIN"
echo ""
echo "Certbot te pedira un correo electronico y aceptar los terminos."
echo "Despues de eso, tu sitio sera accesible por HTTPS automaticamente."

echo ""
echo "=========================================="
echo " Despliegue completado!"
echo "=========================================="
echo " URL: http://$DOMAIN"
echo " (Despues de certbot: https://$DOMAIN)"
echo ""
echo " Comandos utiles:"
echo "   docker compose logs -f app     # Ver logs"
echo "   docker compose restart app     # Reiniciar app"
echo "   docker compose down            # Apagar todo"
echo "   docker compose up -d --build   # Rebuild y reiniciar"
echo "=========================================="
