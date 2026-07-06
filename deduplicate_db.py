import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

def _norm(s: str) -> str:
    return str(s).strip().lower() if s else ""

async def main():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    clients = await db.clients.find({}).to_list(None)
    
    # Sort clients by created_at to keep the oldest
    clients.sort(key=lambda x: x.get("created_at", ""))
    
    groups = {}
    
    for c in clients:
        # Grouping key based on all 5 fields
        key = (
            _norm(c.get("name")),
            _norm(c.get("phone")),
            _norm(c.get("email")),
            _norm(c.get("gstin")),
            _norm(c.get("place_of_supply"))
        )
        if key not in groups:
            groups[key] = []
        groups[key].append(c)
        
    deleted_count = 0
    total_duplicates_found = 0
    
    for key, records in groups.items():
        if len(records) > 1:
            total_duplicates_found += (len(records) - 1)
            # keep records[0] (oldest)
            keep_id = records[0]["id"]
            delete_ids = [r["id"] for r in records[1:]]
            
            print(f"Found {len(records)} records for key {key}. Keeping {keep_id}. Deleting {delete_ids}")
            
            for d_id in delete_ids:
                # Optional: Relink projects and documents to the kept ID
                await db.projects.update_many({"client_id": d_id}, {"$set": {"client_id": keep_id}})
                await db.documents.update_many({"client_id": d_id}, {"$set": {"client_id": keep_id}})
                await db.invoices.update_many({"client_id": d_id}, {"$set": {"client_id": keep_id, "client_name": records[0].get("name")}})
                
                # Delete the duplicate client
                res = await db.clients.delete_one({"id": d_id})
                if res.deleted_count:
                    deleted_count += 1

    print(f"\nScan complete.")
    print(f"Total clients scanned: {len(clients)}")
    print(f"Total duplicates found: {total_duplicates_found}")
    print(f"Total duplicates deleted: {deleted_count}")

if __name__ == "__main__":
    asyncio.run(main())
