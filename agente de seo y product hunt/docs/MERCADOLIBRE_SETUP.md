# Guía: Crear Cuenta de Desarrollador en MercadoLibre

## Paso 1: Registrarse como Desarrollador

1. Ve a https://developers.mercadolibre.com.ar/devcenter
2. Inicia sesión con tu cuenta de MercadoLibre (o crea una)
3. Acepta los términos del programa de desarrolladores

## Paso 2: Crear una Aplicación

1. En el DevCenter, haz clic en "Crear nueva aplicación"
2. Completa los campos:
   - **Nombre**: Market Research Pipeline
   - **Descripción breve**: Investigación de mercado automatizada
   - **URL de redirect**: `https://localhost:8080/callback`
   - **Tópicos**: Selecciona los permisos que necesites
3. Haz clic en "Crear aplicación"

## Paso 3: Obtener Credenciales

Después de crear la app, verás:
- **App ID (Client ID)**: Un número largo
- **Secret Key (Client Secret)**: Una cadena alfanumérica

## Paso 4: Configurar en el Proyecto

1. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` con tus credenciales:
   ```
   ML_CLIENT_ID=tu_app_id_aqui
   ML_CLIENT_SECRET=tu_secret_key_aqui
   ML_REDIRECT_URI=https://localhost:8080/callback
   ```

## Paso 5: Verificar Conexión

```bash
python scripts/test_apis.py
```

Deberías ver respuestas OK para las categorías de MEC, MLM y MCO.

## Notas Importantes

- **La mayoría de endpoints de lectura NO requieren autenticación** (categorías, búsqueda, tendencias)
- Autenticación OAuth2 solo se necesita para endpoints privados (publicar, gestionar ventas)
- Rate limit: **1500 requests por minuto** — más que suficiente
- Los Site IDs del proyecto son: MEC (Ecuador), MLM (México), MCO (Colombia)

## Endpoints Útiles (sin auth)

```
# Categorías de un sitio
GET https://api.mercadolibre.com/sites/MLM/categories

# Tendencias generales
GET https://api.mercadolibre.com/trends/MLM

# Buscar productos más vendidos
GET https://api.mercadolibre.com/sites/MLM/search?category=MLM1055&sort=sold_quantity_desc&limit=50

# Detalles de un producto
GET https://api.mercadolibre.com/items/MLM123456789
```
