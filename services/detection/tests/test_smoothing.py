"""smoothing: un cuadro aislado no cambia el estado reportado."""
from sabanago_detection.smoothing import Smoother


def test_cuadro_aislado_no_cambia():
    s = Smoother()
    assert s.update(1, "free") == "free"
    assert s.update(1, "free") == "free"
    # occupied aislado entre frees: no debe reportarse occupied
    assert s.update(1, "occupied") == "free"
    assert s.update(1, "free") == "free"


def test_mayoria_si_cambia():
    s = Smoother()
    s.update(1, "free")
    s.update(1, "occupied")
    # 2 de 3 occupied -> cambia
    assert s.update(1, "occupied") == "occupied"
