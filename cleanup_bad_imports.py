import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def main():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    clients = await db.clients.find({}).to_list(None)
    deleted = 0
    for c in clients:
        phone = c.get("phone", "")
        gstin = c.get("gstin", "")
        if phone and phone == gstin:
            print(f"Deleting bad import: {c.get('name')} (GSTIN: {gstin})")
            await db.clients.delete_one({"_id": c["_id"]})
            deleted += 1
            
    print(f"Cleanup complete. Deleted {deleted} bad imports.")

if __name__ == "__main__":
    asyncio.run(main())
