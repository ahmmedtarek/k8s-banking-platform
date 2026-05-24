from fastapi import FastAPI
from sqlalchemy.orm import Session
from sqlalchemy import text
from contextlib import contextmanager
from datetime import datetime
import time

from database import SessionLocal, engine
from models import Base, Account, Transaction

app = FastAPI()


# ---------------------------
# WAIT FOR POSTGRES + CREATE TABLES
# Retries until the DB is reachable, then runs create_all.
# Prevents "relation does not exist" when the backend pod
# starts before the postgres pod is fully ready.
# ---------------------------
def init_db(retries: int = 10, delay: int = 3):
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            Base.metadata.create_all(bind=engine)
            print("Database ready and tables created.")
            return
        except Exception as e:
            print(f"DB not ready (attempt {attempt}/{retries}): {e}")
            if attempt < retries:
                time.sleep(delay)
    raise RuntimeError("Could not connect to the database after multiple retries.")


init_db()

# ---------------------------
# DB SESSION SAFE WRAPPER
# ---------------------------
@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# ---------------------------
# SEED DATA
# ---------------------------
@app.post("/api/seed")
def seed():
    with get_db() as db:
        if db.query(Account).count() == 0:
            db.add_all([
                Account(username="ahmed", balance=7500),
                Account(username="mohamed", balance=3000),
            ])
    return {"message": "seeded"}


# ---------------------------
# GET ACCOUNTS
# ---------------------------
@app.get("/api/accounts")
def get_accounts():
    with get_db() as db:
        accounts = db.query(Account).all()

        return [
            {
                "id": a.id,
                "username": a.username,
                "balance": a.balance
            }
            for a in accounts
        ]


# ---------------------------
# CREATE ACCOUNT
# ---------------------------
@app.post("/api/create-account")
def create_account(username: str, balance: float = 0):
    with get_db() as db:
        db.add(Account(username=username, balance=balance))
    return {"message": "created"}


# ---------------------------
# DEPOSIT
# ---------------------------
@app.post("/api/deposit")
def deposit(user: str, amount: float):
    with get_db() as db:
        acc = db.query(Account).filter(Account.username == user).first()

        if not acc:
            return {"error": "user not found"}

        acc.balance += amount

        db.add(Transaction(
            from_user="BANK",
            to_user=user,
            amount=amount,
            timestamp=datetime.utcnow()
        ))

    return {"message": "deposit success"}


# ---------------------------
# TRANSFER
# ---------------------------
@app.post("/api/transfer")
def transfer(from_user: str, to_user: str, amount: float):
    with get_db() as db:
        sender = db.query(Account).filter(Account.username == from_user).first()
        receiver = db.query(Account).filter(Account.username == to_user).first()

        if not sender or not receiver:
            return {"error": "user not found"}

        if sender.balance < amount:
            return {"error": "insufficient balance"}

        sender.balance -= amount
        receiver.balance += amount

        db.add(Transaction(
            from_user=from_user,
            to_user=to_user,
            amount=amount,
            timestamp=datetime.utcnow()
        ))

    return {"message": "transfer success"}


# ---------------------------
# TRANSACTIONS
# ---------------------------
@app.get("/api/transactions")
def transactions():
    with get_db() as db:
        tx = db.query(Transaction).all()

        return [
            {
                "from": t.from_user,
                "to": t.to_user,
                "amount": t.amount,
                "time": str(t.timestamp)
            }
            for t in tx
        ]