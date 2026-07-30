import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # Use MONGO_URL from environment if available, otherwise default to localhost
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    print(f"Connecting to MongoDB at: {mongo_url}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client.creator_consultant
    
    print("Fetching existing accounting tasks...")
    tasks = await db.tasks.find({"category": "accounting"}).to_list(None)
    
    if not tasks:
        print("No accounting tasks found. Nothing to migrate.")
        return

    updates = 0
    status_updates = 0
    
    for t in tasks:
        set_fields = {}
        
        # 1. Migrate description -> notes
        if t.get("description") and not t.get("notes"):
            set_fields["notes"] = t["description"]
            
        # 2. Migrate due_date -> follow_up_date
        if t.get("due_date") and not t.get("follow_up_date"):
            set_fields["follow_up_date"] = t["due_date"]
            
        # 3. Migrate status "in progress" -> "follow up required"
        if t.get("status") == "in progress":
            set_fields["status"] = "follow up required"
            status_updates += 1
            
        if set_fields:
            await db.tasks.update_one(
                {"_id": t["_id"]},
                {"$set": set_fields}
            )
            updates += 1
            
    print(f"Migration completed successfully!")
    print(f"- Total accounting tasks processed: {len(tasks)}")
    print(f"- Tasks updated: {updates}")
    print(f"- Tasks with status changed from 'in progress' to 'follow up required': {status_updates}")

if __name__ == "__main__":
    asyncio.run(main())
