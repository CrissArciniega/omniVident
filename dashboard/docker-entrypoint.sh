#!/bin/sh
# ============================================================
# Script de arranque para Docker
# 1. Espera a que MySQL este disponible
# 2. Ejecuta el seed (crea tablas + usuario admin)
# 3. Inicia el servidor Express
# ============================================================

echo "[Docker] Esperando a que MySQL este listo..."

# Intentar conectar a MySQL hasta 30 veces (1 segundo entre intentos)
MAX_RETRIES=30
RETRIES=0

while [ $RETRIES -lt $MAX_RETRIES ]; do
  # Intentar ejecutar una consulta simple
  node -e "
    const mysql = require('mysql2/promise');
    mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '3306')
    }).then(c => { c.end(); process.exit(0); }).catch(() => process.exit(1));
  " 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "[Docker] MySQL conectado!"
    break
  fi

  RETRIES=$((RETRIES + 1))
  echo "[Docker] MySQL no disponible, reintentando ($RETRIES/$MAX_RETRIES)..."
  sleep 2
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  echo "[Docker] ERROR: No se pudo conectar a MySQL despues de $MAX_RETRIES intentos"
  exit 1
fi

# Ejecutar seed (crea tablas + usuario admin si no existen)
echo "[Docker] Ejecutando seed de base de datos..."
node db/seed.js

echo "[Docker] Iniciando servidor..."
exec node server/index.js
