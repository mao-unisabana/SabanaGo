import sys
from pathlib import Path

# el paquete vive un nivel arriba de tests/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
