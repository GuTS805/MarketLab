from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, Integer, Boolean, UniqueConstraint, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class User(Base):
    __tablename__="users"; id: Mapped[int]=mapped_column(primary_key=True); email: Mapped[str]=mapped_column(String(255),unique=True,index=True); password_hash: Mapped[str]=mapped_column(String(255)); created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
class Instrument(Base):
    __tablename__="instruments"; id: Mapped[int]=mapped_column(primary_key=True); symbol: Mapped[str]=mapped_column(String(40),unique=True,index=True); name: Mapped[str|None]=mapped_column(String(255)); sector: Mapped[str|None]=mapped_column(String(120)); is_benchmark: Mapped[bool]=mapped_column(Boolean,default=False)
class DailyPrice(Base):
    __tablename__="daily_prices"; id: Mapped[int]=mapped_column(primary_key=True); instrument_id: Mapped[int]=mapped_column(ForeignKey("instruments.id"),index=True); date: Mapped[date]=mapped_column(Date,index=True); open: Mapped[Decimal]=mapped_column(Numeric(18,4)); high: Mapped[Decimal]=mapped_column(Numeric(18,4)); low: Mapped[Decimal]=mapped_column(Numeric(18,4)); close: Mapped[Decimal]=mapped_column(Numeric(18,4)); adj_close: Mapped[Decimal|None]=mapped_column(Numeric(18,4)); volume: Mapped[int]=mapped_column(Integer,default=0); dividends: Mapped[Decimal]=mapped_column(Numeric(18,4),default=0); stock_splits: Mapped[Decimal]=mapped_column(Numeric(18,6),default=0); __table_args__=(UniqueConstraint("instrument_id","date"),Index("ix_price_inst_date","instrument_id","date"))
class Simulation(Base):
    __tablename__="simulations"; id: Mapped[int]=mapped_column(primary_key=True); user_id: Mapped[int]=mapped_column(ForeignKey("users.id"),index=True); name: Mapped[str]=mapped_column(String(120),default="Sandbox"); current_date: Mapped[date]=mapped_column(Date); start_date: Mapped[date]=mapped_column(Date); cash: Mapped[Decimal]=mapped_column(Numeric(18,2),default=100000); initial_cash: Mapped[Decimal]=mapped_column(Numeric(18,2),default=100000); active: Mapped[bool]=mapped_column(Boolean,default=True); version: Mapped[int]=mapped_column(Integer,default=0); fees_enabled: Mapped[bool]=mapped_column(Boolean,default=False)
class Order(Base):
    __tablename__="orders"; id: Mapped[int]=mapped_column(primary_key=True); simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id"),index=True); instrument_id: Mapped[int]=mapped_column(ForeignKey("instruments.id")); side: Mapped[str]=mapped_column(String(4)); order_type: Mapped[str]=mapped_column(String(8)); quantity: Mapped[int]=mapped_column(Integer); limit_price: Mapped[Decimal|None]=mapped_column(Numeric(18,2)); status: Mapped[str]=mapped_column(String(16),default="pending"); submitted_date: Mapped[date]=mapped_column(Date); created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
class Fill(Base):
    __tablename__="fills"; id: Mapped[int]=mapped_column(primary_key=True); order_id: Mapped[int]=mapped_column(ForeignKey("orders.id"),unique=True); date: Mapped[date]=mapped_column(Date); quantity: Mapped[int]=mapped_column(Integer); price: Mapped[Decimal]=mapped_column(Numeric(18,2))
class Holding(Base):
    __tablename__="holdings"; id: Mapped[int]=mapped_column(primary_key=True); simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id")); instrument_id: Mapped[int]=mapped_column(ForeignKey("instruments.id")); quantity: Mapped[int]=mapped_column(Integer,default=0); avg_cost: Mapped[Decimal]=mapped_column(Numeric(18,4),default=0); realized_pnl: Mapped[Decimal]=mapped_column(Numeric(18,2),default=0); __table_args__=(UniqueConstraint("simulation_id","instrument_id"),)
class CashLedger(Base):
    __tablename__="cash_ledger"; id: Mapped[int]=mapped_column(primary_key=True); simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id")); date: Mapped[date]=mapped_column(Date); amount: Mapped[Decimal]=mapped_column(Numeric(18,2)); kind: Mapped[str]=mapped_column(String(30)); reference: Mapped[str|None]=mapped_column(String(80))
class Snapshot(Base):
    __tablename__="snapshots"; id: Mapped[int]=mapped_column(primary_key=True); simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id")); date: Mapped[date]=mapped_column(Date); cash: Mapped[Decimal]=mapped_column(Numeric(18,2)); equity: Mapped[Decimal]=mapped_column(Numeric(18,2)); __table_args__=(UniqueConstraint("simulation_id","date"),)
class Watchlist(Base):
    __tablename__="watchlists"; id: Mapped[int]=mapped_column(primary_key=True); user_id: Mapped[int]=mapped_column(ForeignKey("users.id")); instrument_id: Mapped[int]=mapped_column(ForeignKey("instruments.id")); __table_args__=(UniqueConstraint("user_id","instrument_id"),)
class ImportRun(Base):
    __tablename__="import_runs"; id: Mapped[int]=mapped_column(primary_key=True); source_url: Mapped[str]=mapped_column(Text); revision: Mapped[str]=mapped_column(String(64)); symbols: Mapped[str]=mapped_column(Text); coverage: Mapped[str]=mapped_column(String(80)); imported_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); validation_json: Mapped[str]=mapped_column(Text)

class ModelRun(Base):
    __tablename__="model_runs"
    id: Mapped[int]=mapped_column(primary_key=True)
    simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id"),index=True)
    instrument_id: Mapped[int]=mapped_column(ForeignKey("instruments.id"),index=True)
    version: Mapped[str]=mapped_column(String(32))
    trained_through: Mapped[date]=mapped_column(Date,index=True)
    created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
    samples: Mapped[int]=mapped_column(Integer)
    train_samples: Mapped[int]=mapped_column(Integer)
    test_samples: Mapped[int]=mapped_column(Integer)
    metrics_json: Mapped[str]=mapped_column(Text)
    artifact_json: Mapped[str]=mapped_column(Text)
    holdout_json: Mapped[str]=mapped_column(Text)
    __table_args__=(UniqueConstraint("simulation_id","instrument_id","version","trained_through"),)

class JournalEntry(Base):
    __tablename__="journal_entries"
    id: Mapped[int]=mapped_column(primary_key=True)
    simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id"),index=True)
    instrument_id: Mapped[int]=mapped_column(ForeignKey("instruments.id"),index=True)
    order_id: Mapped[int|None]=mapped_column(ForeignKey("orders.id"),unique=True,nullable=True)
    decision_date: Mapped[date]=mapped_column(Date,index=True)
    decision_close: Mapped[Decimal]=mapped_column(Numeric(18,4))
    reason: Mapped[str]=mapped_column(Text)
    predicted_direction: Mapped[str]=mapped_column(String(4))
    horizon_days: Mapped[int]=mapped_column(Integer)
    baseline_direction: Mapped[str|None]=mapped_column(String(4),nullable=True)
    model_snapshot_json: Mapped[str|None]=mapped_column(Text,nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)

class Challenge(Base):
    __tablename__="challenges"
    id: Mapped[int]=mapped_column(primary_key=True)
    simulation_id: Mapped[int]=mapped_column(ForeignKey("simulations.id"),unique=True,index=True)
    goal: Mapped[str]=mapped_column(String(40))
    start_date: Mapped[date]=mapped_column(Date)
    duration_days: Mapped[int]=mapped_column(Integer,default=20)
    starting_equity: Mapped[Decimal]=mapped_column(Numeric(18,2))
    completed_at: Mapped[datetime|None]=mapped_column(DateTime,nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
