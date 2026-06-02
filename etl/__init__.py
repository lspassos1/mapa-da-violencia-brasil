"""ETL package for Mapa da Violencia Brasil."""

import datetime as _datetime


# Python 3.10 and older do not expose datetime.UTC.
if not hasattr(_datetime, "UTC"):
    _datetime.UTC = _datetime.timezone.utc
