"""Configuracion desde variables de entorno con valores por defecto."""
import os
from dataclasses import dataclass


@dataclass
class Config:
    supabase_url: str
    service_role_key: str
    camera_id: int
    video_source: str
    detector: str
    confidence_threshold: float
    ingest_interval_s: float
    diff_threshold: float


def load() -> Config:
    return Config(
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        camera_id=int(os.environ.get("CAMERA_ID", "1")),
        video_source=os.environ.get("VIDEO_SOURCE", "webcam:0"),
        detector=os.environ.get("DETECTOR", "diff"),
        confidence_threshold=float(os.environ.get("CONFIDENCE_THRESHOLD", "0.7")),
        ingest_interval_s=float(os.environ.get("INGEST_INTERVAL_S", "1.5")),
        diff_threshold=float(os.environ.get("DIFF_THRESHOLD", "25")),
    )
