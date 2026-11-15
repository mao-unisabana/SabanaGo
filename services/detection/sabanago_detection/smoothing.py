"""Suavizado por voto de mayoria en los ultimos 3 cuadros por puesto.

update() devuelve el estado reportado (estable). Un cuadro aislado no cambia
el reporte: hace falta mayoria (>=2 de 3).
"""
from collections import deque


class Smoother:
    def __init__(self, window=3):
        self.window = window
        self._hist = {}       # space_id -> deque de status
        self._reported = {}   # space_id -> status estable actual

    def update(self, space_id, status):
        h = self._hist.setdefault(space_id, deque(maxlen=self.window))
        h.append(status)
        # voto de mayoria
        winner = max(set(h), key=lambda s: list(h).count(s))
        if list(h).count(winner) * 2 > self.window:
            self._reported[space_id] = winner
        # si no hay mayoria clara, se conserva el reporte anterior
        return self._reported.get(space_id, status)
