from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
from datetime import datetime


# 💳 Accounts table
class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    balance = Column(Float, default=0)


# 📜 Transactions table
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    # sender username
    from_user = Column(String, index=True, nullable=False)

    # receiver username
    to_user = Column(String, index=True, nullable=False)

    # transferred amount
    amount = Column(Float, nullable=False)

    # timestamp of transaction
    timestamp = Column(DateTime, default=datetime.utcnow)