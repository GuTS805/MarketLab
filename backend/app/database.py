import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from . import config
from .database_config import connection_settings

URL = os.getenv("DATABASE_URL", "sqlite:///./blindmarket.db")
if URL.startswith("postgres://"): URL = "postgresql+psycopg://" + URL[len("postgres://"):]  # Render/Heroku style URL
elif URL.startswith("postgresql://"): URL = "postgresql+psycopg://" + URL[len("postgresql://"):]
if os.getenv("VERCEL") and URL.startswith("sqlite"):
    # Serverless filesystem is read-only except /tmp: copy the bundled seeded database there once per instance.
    import shutil
    from pathlib import Path
    bundled = Path(__file__).resolve().parent.parent / "blindmarket.db"
    tmp = Path("/tmp/blindmarket.db")
    if bundled.exists() and not tmp.exists(): shutil.copy(bundled, tmp)
    URL = "sqlite:////tmp/blindmarket.db"
url, options = connection_settings(URL, serverless=bool(os.getenv('VERCEL')))
if url.get_backend_name() == 'sqlite' and url.database and url.database != ':memory:' and not Path(url.database).is_absolute():
    url = url.set(database=str(Path(__file__).resolve().parent.parent / url.database))
engine = create_engine(url, **options)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
