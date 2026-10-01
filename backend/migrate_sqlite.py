"""Preview or copy existing SQLite records into an empty Supabase database."""
import argparse
import sqlite3
from pathlib import Path
from sqlalchemy import MetaData, Table, create_engine, func, select, text
from app.database import Base, engine
from app import models
from app.schema import initialize_schema


def migrate(source_path, apply=False):
    source_path=source_path.resolve()
    if not source_path.is_file():
        raise ValueError('The source SQLite database does not exist.')
    if engine.dialect.name!='postgresql':
        raise ValueError('Set DATABASE_URL to your Supabase PostgreSQL URI in the root .env first.')
    source=create_engine('sqlite://',creator=lambda:sqlite3.connect(f'file:{source_path.as_posix()}?mode=ro',uri=True))
    source_meta=MetaData()
    source_meta.reflect(source)
    counts={}
    with source.connect() as connection:
        for table in Base.metadata.sorted_tables:
            counts[table.name]=connection.scalar(select(func.count()).select_from(source_meta.tables[table.name])) if table.name in source_meta.tables else 0
    for name,count in counts.items(): print(f'{name}: {count} records')
    if not apply:
        print('Preview only. To copy these records to an empty destination, rerun with --apply.')
        source.dispose()
        return
    initialize_schema(engine,Base.metadata)
    with source.connect() as read,engine.begin() as write:
        for table in Base.metadata.sorted_tables:
            if write.scalar(select(func.count()).select_from(table)):
                raise ValueError('Destination contains application records. Migration stopped without replacing any data.')
        for table in Base.metadata.sorted_tables:
            if table.name not in source_meta.tables: continue
            result=read.execute(select(source_meta.tables[table.name]))
            while rows:=result.mappings().fetchmany(1000):
                write.execute(table.insert(),[dict(row) for row in rows])
            actual=write.scalar(select(func.count()).select_from(table))
            if actual!=counts[table.name]: raise ValueError(f'Record count mismatch in {table.name}; transaction will roll back.')
            if 'id' in table.c:
                sequence=write.scalar(text("SELECT pg_get_serial_sequence(:table_name, 'id')"),{'table_name':table.name})
                if sequence:
                    maximum=write.scalar(select(func.max(table.c.id))) or 0
                    write.execute(text('SELECT setval(CAST(:sequence AS regclass), :value, :called)'),{'sequence':sequence,'value':max(maximum,1),'called':bool(maximum)})
            print(f'Copied {table.name}: {actual}')
    source.dispose()
    print('Migration completed. Your original SQLite file has been preserved.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parent/'blindmarket.db')
    parser.add_argument('--apply',action='store_true',help='Write to the configured empty PostgreSQL database.')
    args=parser.parse_args()
    try: migrate(args.source,args.apply)
    except ValueError as error: parser.exit(1,f'{error}\n')
    except Exception: parser.exit(1,'Database operation failed. Check connection settings and database access. No source records were changed.\n')
