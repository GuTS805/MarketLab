from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool
from app.database_config import connection_settings
from app.schema import initialize_schema
from app.database import Base


def test_sqlite_stays_available_for_local_work():
    url,options=connection_settings('sqlite:///./blindmarket.db')
    assert url.drivername=='sqlite'
    assert options['connect_args']=={'check_same_thread':False}


def test_supabase_session_pooler_has_ssl_and_bounded_pool():
    url,options=connection_settings('postgres://postgres.example:password@aws-0-test.pooler.supabase.com:5432/postgres')
    assert url.drivername=='postgresql+psycopg'
    assert url.query['sslmode']=='require'
    assert options['pool_size']==5 and options['max_overflow']==2
    assert 'prepare_threshold' not in options['connect_args']


def test_transaction_pooler_disables_prepared_statements():
    url,options=connection_settings('postgresql://postgres.example:password@aws-0-test.pooler.supabase.com:6543/postgres')
    assert options['poolclass'] is NullPool
    assert options['connect_args']['prepare_threshold'] is None
    assert url.query['sslmode']=='require'


def test_explicit_ssl_and_encoded_password_are_preserved():
    url,_=connection_settings('postgresql://postgres:p%40ss%3Aword@db.example.supabase.co:5432/postgres?sslmode=verify-full')
    assert url.password=='p@ss:word'
    assert url.query['sslmode']=='verify-full'


def test_serverless_uses_null_pool():
    _,options=connection_settings('postgresql://user:password@localhost/test',serverless=True)
    assert options['poolclass'] is NullPool


def test_old_sqlite_columns_are_migrated():
    engine=create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE simulations (id INTEGER PRIMARY KEY)'))
        connection.execute(text('CREATE TABLE challenges (id INTEGER PRIMARY KEY)'))
    initialize_schema(engine,Base.metadata)
    assert 'fees_enabled' in {c['name'] for c in inspect(engine).get_columns('simulations')}
    assert 'completed_at' in {c['name'] for c in inspect(engine).get_columns('challenges')}
