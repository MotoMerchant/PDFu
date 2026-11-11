"""Entry point for running from source (run.bat) and for the PyInstaller build."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdfu.app import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
