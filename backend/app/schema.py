"""Create the application schema and keep Supabase's browser API closed."""
from sqlalchemy import inspect, text


def initialize_schema(engine, metadata):
    metadata.create_all(engine)
    with engine.begin() as connection:
        inspector = inspect(connection)
        if 'fees_enabled' not in [c['name'] for c in inspector.get_columns('simulations')]:
            connection.execute(text('ALTER TABLE simulations ADD COLUMN fees_enabled BOOLEAN DEFAULT FALSE'))
        if inspector.has_table('challenges') and 'completed_at' not in [c['name'] for c in inspector.get_columns('challenges')]:
            connection.execute(text('ALTER TABLE challenges ADD COLUMN completed_at TIMESTAMP'))
        host = engine.url.host or ''
        if engine.dialect.name == 'postgresql':
            # Older SQLite installations may contain balances beyond NUMERIC(18,2).
            # Widen existing monetary columns without changing their values.
            from sqlalchemy import Numeric, BigInteger
            quote = engine.dialect.identifier_preparer.quote
            for table in metadata.sorted_tables:
                existing = {c['name']: c['type'] for c in inspector.get_columns(table.name)}
                for column in table.c:
                    previous = existing.get(column.name)
                    if isinstance(column.type, BigInteger) and previous is not None and not isinstance(previous, BigInteger):
                        connection.execute(text(f'ALTER TABLE {quote(table.name)} ALTER COLUMN {quote(column.name)} TYPE BIGINT'))
                    if isinstance(column.type, Numeric) and isinstance(previous, Numeric):
                        if column.type.precision and previous.precision and previous.precision < column.type.precision and previous.scale == column.type.scale:
                            connection.execute(text(f'ALTER TABLE {quote(table.name)} ALTER COLUMN {quote(column.name)} TYPE NUMERIC({column.type.precision},{column.type.scale})'))
        if engine.dialect.name != 'postgresql' or not host.endswith(('.supabase.co', '.supabase.com')):
            return
        roles = connection.execute(text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")).scalars().all()
        quote = engine.dialect.identifier_preparer.quote
        for table in metadata.sorted_tables:
            name = f'public.{quote(table.name)}'
            connection.execute(text(f'ALTER TABLE {name} ENABLE ROW LEVEL SECURITY'))
            for role in roles:
                connection.execute(text(f'REVOKE ALL ON TABLE {name} FROM {quote(role)}'))
