# Felixito STL API

API FastAPI para procesar imágenes, limpiar contornos, vectorizar y generar archivos STL.

## Endpoints

- `GET /health` — comprobación de estado.
- `POST /procesar-imagen` — convierte imagen a binario.
- `POST /limpiar` — limpia contornos de una imagen binaria.
- `POST /vectorizar-contornos` — devuelve `vector_paths`.
- `POST /generar-stl` — genera STL desde `vector_paths`.
- `POST /imagen-a-stl` — genera STL directamente desde imagen.

## Ejecutar local

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Abrir:

```text
http://localhost:8000/docs
```

## Despliegue recomendado

Para producción, usar Docker/Render/Railway/Fly.io.

```bash
docker build -t felixito-stl-api .
docker run -p 8000:8000 felixito-stl-api
```

## Nota

El ZIP recibido también contiene una app de Apps Script (`click-consent-app`) y varios binarios/ZIP/STL. El código ejecutable principal publicado aquí es la API de generación STL.
