from __future__ import annotations

from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel, Field

from vector_utils import generar_stl_desde_vector_paths

app = FastAPI(
    title="Felixito STL API",
    description="API para procesar imágenes, vectorizar contornos y generar archivos STL.",
    version="1.0.0",
)


class STLRequest(BaseModel):
    vector_paths: List[List[List[float]]] = Field(..., description="Lista de contornos [[x,y], ...].")
    altura_extrusion: float = Field(5.0, gt=0, le=100, description="Altura de extrusión en milímetros.")


def _decode_image(contents: bytes, mode: int = cv2.IMREAD_COLOR) -> np.ndarray:
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, mode)
    if img is None:
        raise HTTPException(status_code=400, detail="No se pudo leer la imagen enviada.")
    return img


def _png_response(img: np.ndarray) -> Response:
    ok, encoded = cv2.imencode(".png", img)
    if not ok:
        raise HTTPException(status_code=500, detail="No se pudo codificar la imagen resultante.")
    return Response(content=encoded.tobytes(), media_type="image/png")


def _preprocess_to_binary(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        15,
        10,
    )

    if np.sum(binary == 0) > np.sum(binary == 255):
        binary = cv2.bitwise_not(binary)

    return binary


def _clean_binary(binary: np.ndarray) -> np.ndarray:
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    cleaned = np.ones_like(binary) * 255

    for contour in contours:
        if cv2.contourArea(contour) > 100:
            cv2.drawContours(cleaned, [contour], -1, 0, thickness=2)

    kernel = np.ones((3, 3), np.uint8)
    closed = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)
    return cv2.dilate(closed, kernel, iterations=1)


def _vectorize(binary: np.ndarray) -> List[List[List[int]]]:
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    paths: List[List[List[int]]] = []

    for contour in contours:
        if cv2.contourArea(contour) <= 100:
            continue

        epsilon = 0.0025 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True).squeeze()

        if approx.ndim != 2 or approx.shape[0] < 3:
            continue

        path = [[int(x), int(y)] for x, y in approx.tolist()]
        if path[0] != path[-1]:
            path.append(path[0])
        paths.append(path)

    if not paths:
        raise HTTPException(status_code=422, detail="No se encontraron contornos válidos.")
    return paths


@app.get("/", response_class=HTMLResponse)
async def root() -> str:
    return """
    <!doctype html>
    <html lang="es">
      <head><meta charset="utf-8"><title>Felixito STL API</title></head>
      <body style="font-family:Arial,sans-serif;max-width:860px;margin:40px auto;line-height:1.5">
        <h1>Felixito STL API</h1>
        <p>API activa para procesar imágenes, vectorizar contornos y generar STL.</p>
        <ul>
          <li><a href="/docs">Documentación Swagger</a></li>
          <li><code>POST /procesar-imagen</code></li>
          <li><code>POST /limpiar</code></li>
          <li><code>POST /vectorizar-contornos</code></li>
          <li><code>POST /generar-stl</code></li>
          <li><code>POST /imagen-a-stl</code></li>
        </ul>
      </body>
    </html>
    """


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/procesar-imagen")
async def procesar_imagen(imagen: UploadFile = File(...)) -> Response:
    contents = await imagen.read()
    img = _decode_image(contents)
    binary = _preprocess_to_binary(img)
    return _png_response(binary)


@app.post("/limpiar")
async def limpiar(imagen: UploadFile = File(...)) -> Response:
    contents = await imagen.read()
    img = _decode_image(contents, cv2.IMREAD_GRAYSCALE)
    cleaned = _clean_binary(img)
    return _png_response(cleaned)


@app.post("/vectorizar-contornos")
async def vectorizar_contornos(imagen: UploadFile = File(...)) -> dict:
    contents = await imagen.read()
    img = _decode_image(contents)
    binary = _preprocess_to_binary(img)
    cleaned = _clean_binary(binary)
    return {"vector_paths": _vectorize(cleaned)}


@app.post("/generar-stl")
async def generar_stl(request: STLRequest) -> FileResponse:
    try:
        output_path = generar_stl_desde_vector_paths(
            request.vector_paths,
            altura_extrusion=request.altura_extrusion,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error generando STL: {exc}") from exc

    return FileResponse(
        path=output_path,
        media_type="model/stl",
        filename="modelo_generado.stl",
    )


@app.post("/imagen-a-stl")
async def imagen_a_stl(
    imagen: UploadFile = File(...),
    altura_extrusion: float = 5.0,
) -> FileResponse:
    contents = await imagen.read()
    img = _decode_image(contents)
    binary = _preprocess_to_binary(img)
    cleaned = _clean_binary(binary)
    paths = _vectorize(cleaned)

    try:
        output_path = generar_stl_desde_vector_paths(paths, altura_extrusion=altura_extrusion)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return FileResponse(
        path=output_path,
        media_type="model/stl",
        filename="modelo_generado.stl",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000)
