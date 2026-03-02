# OmniVident — Mission Control Dashboard

Panel de control centralizado para los agentes de IA de MegaMayorista.

---

## Requisitos

- Node.js v18+
- MySQL 5.7+ (ya configurado con password)
- Python 3.11+ (para el agente de mercado)
- Playwright instalado (para scraping de MercadoLibre)

---

## Instalacion (primera vez)

```bash
cd C:\Users\Criss\Downloads\omniVident\dashboard

# 1. Instalar dependencias backend
npm install

# 2. Instalar dependencias frontend
cd client && npm install && cd ..

# 3. Crear base de datos y usuario admin
node db/seed.js
```

---

## Iniciar el dashboard

```bash
cd C:\Users\Criss\Downloads\omniVident\dashboard

# Iniciar backend (puerto 3001) y frontend (puerto 5173) juntos:
npm run dev

# O por separado:
node server/index.js                    # Backend solo
cd client && npx vite --host            # Frontend solo
```

Abrir: **http://localhost:5173**
Login: `gerencia@megamayorista.org` / `megaMayorist@1`

---

## Comandos frecuentes

### Dashboard

| Comando | Que hace |
|---------|----------|
| `npm run dev` | Inicia backend + frontend juntos |
| `node server/index.js` | Solo el backend API (puerto 3001) |
| `cd client && npx vite` | Solo el frontend (puerto 5173) |
| `node db/seed.js` | Reinicializa la DB y el usuario admin |
| `cd client && npx vite build` | Compila el frontend para produccion |

### Agente de Estudio de Mercado (SEO)

```bash
cd "C:\Users\Criss\Downloads\omniVident\agente de seo y product hunt"

# Ejecutar scraping completo (todos los paises: EC, MX, CO)
python agents/mercadolibre_collector.py

# Solo un pais especifico
python agents/mercadolibre_collector.py --country MX
python agents/mercadolibre_collector.py --country EC
python agents/mercadolibre_collector.py --country CO

# Test rapido (solo 1 categoria, para verificar que funciona)
python agents/mercadolibre_collector.py --country MX --test

# Validar configuracion
python scripts/validate_config.py

# Probar APIs
python scripts/test_apis.py
```

Los datos se guardan en: `outputs/raw/raw_mercadolibre_{PAIS}_{FECHA}.json`

### Agente de Contenido y RRSS

```bash
cd "C:\Users\Criss\Downloads\omniVident\agente contenido y rrss"

# Generar Excel completo + content packs (guiones Word)
node run_agent.js

# Pipeline Python completo (5 fases)
python run_pipeline.py --full

# Solo una fase especifica
python run_pipeline.py --phase 1    # Keywords
python run_pipeline.py --phase 2    # Ranking
python run_pipeline.py --phase 3    # Guiones
python run_pipeline.py --phase 4    # Diseno
python run_pipeline.py --phase 5    # Export

# Ver estado del ultimo pipeline
python run_pipeline.py --status

# Iniciar scheduler automatico (quincenal)
python run_pipeline.py --schedule
```

Los datos se guardan en: `output/` (Excel, content_packs/, JSONs por fase)

---

## Base de datos MySQL

### Conexion

| Campo | Valor |
|-------|-------|
| Host | `localhost` |
| Puerto | `3306` |
| Usuario | `root` |
| Password | `3antiserver3` |
| Database | `omnivident` |

### Queries utiles

```sql
USE omnivident;

-- Ver todos los usuarios
SELECT id, email, name, role, created_at FROM users;

-- Crear un nuevo usuario (generar hash con: node -e "require('bcryptjs').hash('miPassword',12).then(console.log)")
INSERT INTO users (email, password_hash, name, role)
VALUES ('nuevo@email.com', '$2a$12$HASH_AQUI', 'Nombre', 'viewer');

-- Ver historial de ejecuciones
SELECT e.*, a.name as agent_name
FROM executions e
JOIN agents a ON e.agent_id = a.id
ORDER BY e.created_at DESC;

-- Ver agentes registrados
SELECT * FROM agents;

-- Cambiar password de un usuario
-- Primero genera el hash: node -e "require('bcryptjs').hash('nuevoPass',12).then(console.log)"
UPDATE users SET password_hash = '$2a$12$NUEVO_HASH' WHERE email = 'gerencia@megamayorista.org';

-- Eliminar ejecuciones antiguas (mas de 30 dias)
DELETE FROM executions WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Generar hash de password

```bash
cd C:\Users\Criss\Downloads\omniVident\dashboard
node -e "require('bcryptjs').hash('tuPasswordAqui', 12).then(h => console.log(h))"
```

---

## Estructura de archivos

```
dashboard/
  .env                    # Variables de entorno (DB, JWT, rutas)
  db/init.sql             # Esquema de la DB
  db/seed.js              # Script para crear DB y usuario admin
  server/
    index.js              # Servidor Express (API)
    config/db.js          # Conexion MySQL
    middleware/auth.js     # JWT middleware
    routes/
      auth.js             # Login/me
      agents.js           # CRUD agentes + ejecutar
      market.js           # Datos de mercado
      content.js          # Contenido y descargas
    services/
      stateWatcher.js     # Lee state.json de agentes
      marketParser.js     # Parsea JSONs de MercadoLibre
      excelParser.js      # Parsea Excel RRSS
      contentLister.js    # Lista content packs
      agentRunner.js      # Ejecuta agentes via child_process
  client/
    src/
      pages/
        Login.jsx         # Pagina de login
        Dashboard.jsx     # Dashboard principal
        MarketAgent.jsx   # Estudio de mercado
        ContentAgent.jsx  # Contenido y RRSS
      components/
        Layout.jsx        # Sidebar + header
        AgentCard.jsx     # Tarjeta de agente
        StatusBadge.jsx   # Badge de estado
        RunAgentButton.jsx # Boton ejecutar agente
        ProductTable.jsx  # Tabla de productos
        PriceChart.jsx    # Graficos
        ...
```

---

## Troubleshooting

| Problema | Solucion |
|----------|----------|
| `EADDRINUSE :3001` | Ya hay un servidor corriendo. Matalo: `npx kill-port 3001` |
| `ER_ACCESS_DENIED` | Verifica password en `.env` |
| `Cannot find module` | Ejecuta `npm install` en `dashboard/` y `dashboard/client/` |
| Login no funciona | Ejecuta `node db/seed.js` para recrear el usuario |
| Datos no se actualizan | Ejecuta el agente manualmente o usa el boton "Ejecutar Ahora" |
| Frontend no carga | Verifica que el backend este corriendo en puerto 3001 |
