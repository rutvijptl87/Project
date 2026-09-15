import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

def _get_financial_year(dt: datetime) -> str:
    if dt.month >= 4:
        return f"{dt.strftime('%y')}/{(dt.year + 1) % 100:02d}"
    else:
        return f"{(dt.year - 1) % 100:02d}/{dt.strftime('%y')}"

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.creator_consultant
    
    invoices = await db.invoices.find({}).to_list(None)
    migrated_count = 0
    for inv in invoices:
        old_no = inv.get("invoice_no", "")
        if not old_no:
            continue
            
        # Extract sequence
        match = re.search(r'(\d+)$', old_no)
        if not match:
            continue
        seq = int(match.group(1))
        
        # Get date
        inv_date = inv.get("invoice_date", "")
        try:
            dt = datetime.strptime(inv_date, "%Y-%m-%d")
        except:
            dt = datetime.now()
                
        fy = _get_financial_year(dt)
        mo = dt.strftime('%b').upper()
        
        # Get project name
        project_name = "General"
        project_id = inv.get("project_id")
        if project_id:
            project = await db.projects.find_one({"id": project_id})
            if project and project.get("name"):
                project_name = str(project["name"]).strip()
                
        if inv.get("type") == "proforma" or "PIC" in old_no:
            new_no = f"CC-PIC-{mo}{fy}-{seq:03d}-{project_name}"
        else:
            new_no = f"CC-TAX-{mo}{fy}-{seq:03d}-{project_name}"
            
        if old_no == new_no:
            continue
            
        print(f"Migrating: {old_no} -> {new_no}")
        
        # Update invoice
        await db.invoices.update_one({"_id": inv["_id"]}, {"$set": {"invoice_no": new_no}})
        
        # Update related payments
        await db.payments.update_many({"invoice_no": old_no}, {"$set": {"invoice_no": new_no}})
        migrated_count += 1
        
    print(f"Migrated {migrated_count} invoices.")

asyncio.run(main())
