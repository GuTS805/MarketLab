"""Check database connectivity without printing connection credentials."""
from sqlalchemy import inspect, text
from app.database import engine


def check():
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
        names=inspect(connection).get_table_names()
    host=engine.url.host or ''
    provider='Supabase PostgreSQL' if host.endswith(('.supabase.co','.supabase.com')) else engine.dialect.name
    print(f'Connected: {provider}')
    print(f'Available tables: {len(names)}')
    print('Application tables found.' if 'simulations' in names else 'Start the backend to initialize application tables.')


if __name__=='__main__':
    try: check()
    except Exception:
        raise SystemExit('Connection failed. Check DATABASE_URL, the encoded password, network access and Supabase project status in your local .env.')
