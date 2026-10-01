"""SQLAlchemy connection options shared by local SQLite and Supabase Postgres."""
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool


def connection_settings(raw_url, serverless=False):
    if raw_url.startswith('postgres://'):
        raw_url = 'postgresql://' + raw_url[len('postgres://'):]
    url = make_url(raw_url)
    options = {'pool_pre_ping': True}
    if url.get_backend_name() == 'sqlite':
        options['connect_args'] = {'check_same_thread': False}
        return url, options
    if url.get_backend_name() != 'postgresql':
        raise ValueError('DATABASE_URL must be a SQLite or PostgreSQL connection string')
    if url.drivername == 'postgresql':
        url = url.set(drivername='postgresql+psycopg')
    supabase = bool(url.host and (url.host.endswith('.supabase.co') or url.host.endswith('.supabase.com')))
    if supabase and 'sslmode' not in url.query:
        url = url.update_query_dict({'sslmode': 'require'})
    transaction_pooler = bool(supabase and url.port == 6543)
    options['connect_args'] = {'connect_timeout': 10}
    if url.drivername == 'postgresql+psycopg' and transaction_pooler:
        options['connect_args']['prepare_threshold'] = None
    if transaction_pooler or serverless:
        options['poolclass'] = NullPool
    else:
        options.update(pool_size=5, max_overflow=2, pool_timeout=15, pool_recycle=1800)
    return url, options
