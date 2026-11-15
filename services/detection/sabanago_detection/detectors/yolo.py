"""Detector YOLOv8n sobre clases de vehiculo de COCO.

Ocupacion = area(interseccion caja-poligono) / area(poligono). >= 0.30 ->
occupied. Carga perezosa del modelo para que los tests corran sin descargar
pesos ni ultralytics.
"""
from shapely.geometry import Polygon, box

# clases COCO de vehiculo: car, motorcycle, bus, truck
VEHICLE_CLASSES = {2, 3, 5, 7}
COVERAGE_OCCUPIED = 0.30
CANDIDATE_CONF = 0.25

_model = None


def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO  # import perezoso

        _model = YOLO("yolov8n.pt")
    return _model


def _boxes_from_model(frame):
    """(x1,y1,x2,y2,conf) por deteccion de vehiculo. Separado para testear."""
    model = _get_model()
    result = model(frame, verbose=False)[0]
    out = []
    for b in result.boxes:
        cls = int(b.cls[0])
        conf = float(b.conf[0])
        if cls in VEHICLE_CLASSES and conf >= CANDIDATE_CONF:
            x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
            out.append((x1, y1, x2, y2, conf))
    return out


def decide(poly_pts, boxes):
    """Estado de un puesto dado su poligono y las cajas (x1,y1,x2,y2,conf).

    Logica pura, sin modelo: el nucleo testeable.
    """
    poly = Polygon(poly_pts)
    area = poly.area
    if area <= 0:
        return ("free", 0.95)
    best_cov = 0.0
    best_conf = 0.0
    touch_conf = 0.0
    for x1, y1, x2, y2, conf in boxes:
        inter = poly.intersection(box(x1, y1, x2, y2)).area
        if inter <= 0:
            continue
        touch_conf = max(touch_conf, conf)
        cov = inter / area
        if cov > best_cov:
            best_cov = cov
            best_conf = conf
    if best_cov >= COVERAGE_OCCUPIED:
        return ("occupied", best_conf)
    # libre: confianza alta si nada toca el poligono
    return ("free", (1.0 - touch_conf) if touch_conf else 0.95)


def detect(frame, spaces, _boxes=None):
    """_boxes inyectable para tests; en produccion sale del modelo."""
    boxes = _boxes if _boxes is not None else _boxes_from_model(frame)
    out = {}
    for sp in spaces:
        poly = sp.get("image_polygon")
        if not poly:  # ponytail: sin poligono -> omitido, queda no_data
            continue
        out[sp["id"]] = decide(poly, boxes)
    return out
