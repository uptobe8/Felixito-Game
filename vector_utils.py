from __future__ import annotations

import os
import uuid
from typing import Iterable, List

import shapely.ops
import trimesh
from shapely.geometry import MultiPolygon, Polygon

OUTPUT_DIR = "stl_outputs"


def _normalizar_path(path: Iterable[Iterable[float]]) -> list[tuple[float, float]]:
    puntos = [(float(p[0]), float(p[1])) for p in path if len(p) >= 2]
    if len(puntos) < 3:
        return []
    if puntos[0] != puntos[-1]:
        puntos.append(puntos[0])
    return puntos


def generar_stl_desde_vector_paths(
    vector_paths: List[List[List[float]]],
    altura_extrusion: float = 5.0,
) -> str:
    """
    Genera un archivo STL extruyendo contornos 2D.

    Args:
        vector_paths: Lista de contornos. Cada contorno es una lista de puntos [x, y].
        altura_extrusion: Altura de extrusión en la unidad de entrada.

    Returns:
        Ruta local del archivo STL generado.
    """
    if altura_extrusion <= 0:
        raise ValueError("altura_extrusion debe ser mayor que 0.")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    polygons: list[Polygon] = []
    for path in vector_paths:
        puntos = _normalizar_path(path)
        if len(puntos) < 4:
            continue

        poly = Polygon(puntos)
        if not poly.is_valid:
            poly = poly.buffer(0)

        if poly.is_valid and poly.area > 0:
            polygons.append(poly)

    if not polygons:
        raise ValueError("No se encontraron polígonos válidos para extruir.")

    geometry = shapely.ops.unary_union(polygons)
    if isinstance(geometry, Polygon):
        geometry = MultiPolygon([geometry])

    try:
        mesh = trimesh.creation.extrude_polygon(geometry, height=altura_extrusion)
    except Exception as exc:
        raise ValueError(f"Error al extruir la geometría: {exc}") from exc

    if mesh.is_empty:
        raise ValueError("La malla generada está vacía.")

    filename = f"modelo_{uuid.uuid4().hex}.stl"
    output_path = os.path.join(OUTPUT_DIR, filename)

    try:
        mesh.export(output_path)
    except Exception as exc:
        raise ValueError(f"Error al exportar STL: {exc}") from exc

    return output_path
