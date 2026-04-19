"""
Creator Consultant API Tests
Tests for Projects, Clients, Architects, Payments, Dashboard, Export/Import, and Seed endpoints
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== HEALTH CHECK ====================
class TestHealthCheck:
    """Root API health check"""
    
    def test_api_root_returns_ok(self, api_client):
        """GET /api/ should return status ok"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "Creator Consultant" in data["message"]


# ==================== DASHBOARD STATS ====================
class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    def test_dashboard_stats_returns_correct_structure(self, api_client):
        """GET /api/dashboard/stats should return all required fields"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields exist
        required_fields = [
            "total_projects", "total_clients", "total_architects",
            "total_quoted", "total_received", "total_outstanding",
            "outstanding_count", "settled_count"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify seeded data counts (7 projects, 4 clients, 3 architects)
        assert data["total_projects"] == 7
        assert data["total_clients"] == 4
        assert data["total_architects"] == 3
        
        # Verify calculations
        assert data["total_outstanding"] == data["total_quoted"] - data["total_received"]
        assert data["outstanding_count"] + data["settled_count"] == data["total_projects"]


# ==================== PROJECTS CRUD ====================
class TestProjectsCRUD:
    """Projects CRUD operations"""
    
    def test_list_projects_returns_seeded_data(self, api_client):
        """GET /api/projects should return 7 seeded projects with enrichment"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        projects = response.json()
        
        assert len(projects) == 7
        
        # Verify enrichment fields on first project
        p = projects[0]
        assert "id" in p
        assert "project_code" in p
        assert "name" in p
        assert "client_name" in p
        assert "architect_name" in p
        assert "outstanding_amount" in p
        assert "status" in p
        
        # Verify outstanding_amount calculation
        assert p["outstanding_amount"] == p["quoted_amount"] - p["received_amount"]
        
        # Verify status auto-computation
        for proj in projects:
            if proj["outstanding_amount"] <= 0 and proj["quoted_amount"] > 0:
                assert proj["status"] == "Settled"
    
    def test_search_projects_by_name(self, api_client):
        """GET /api/projects?search=... should filter case-insensitively"""
        response = api_client.get(f"{BASE_URL}/api/projects", params={"search": "villa"})
        assert response.status_code == 200
        projects = response.json()
        
        assert len(projects) >= 1
        assert any("Villa" in p["name"] for p in projects)
    
    def test_search_projects_by_client_name(self, api_client):
        """Search should work on client_name"""
        response = api_client.get(f"{BASE_URL}/api/projects", params={"search": "Rohan"})
        assert response.status_code == 200
        projects = response.json()
        
        assert len(projects) >= 1
        assert all("Rohan" in p["client_name"] for p in projects)
    
    def test_search_projects_by_project_code(self, api_client):
        """Search should work on project_code"""
        response = api_client.get(f"{BASE_URL}/api/projects", params={"search": "CC-0001"})
        assert response.status_code == 200
        projects = response.json()
        
        assert len(projects) >= 1
        assert any(p["project_code"] == "CC-0001" for p in projects)
    
    def test_create_project_auto_generates_code(self, api_client):
        """POST /api/projects should auto-generate sequential project_code"""
        payload = {
            "name": "TEST_New Project",
            "quoted_amount": 50000,
            "site_location": "Test Location"
        }
        response = api_client.post(f"{BASE_URL}/api/projects", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["project_code"].startswith("CC-")
        assert data["name"] == "TEST_New Project"
        assert data["received_amount"] == 0
        assert data["outstanding_amount"] == 50000
        assert data["status"] == "Outstanding"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{data['id']}")
    
    def test_get_single_project(self, api_client):
        """GET /api/projects/{id} should return enriched project"""
        # Get first project
        projects = api_client.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == project_id
        assert "client_name" in data
        assert "architect_name" in data
        assert "outstanding_amount" in data
    
    def test_get_nonexistent_project_returns_404(self, api_client):
        """GET /api/projects/{invalid_id} should return 404"""
        response = api_client.get(f"{BASE_URL}/api/projects/nonexistent-id")
        assert response.status_code == 404
    
    def test_update_project_preserves_received_amount(self, api_client):
        """PUT /api/projects/{id} should preserve received_amount"""
        # Create a project
        create_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Update Project",
            "quoted_amount": 100000
        })
        project = create_resp.json()
        project_id = project["id"]
        
        # Update the project
        update_resp = api_client.put(f"{BASE_URL}/api/projects/{project_id}", json={
            "name": "TEST_Updated Project Name",
            "quoted_amount": 120000,
            "site_location": "New Location"
        })
        assert update_resp.status_code == 200
        
        updated = update_resp.json()
        assert updated["name"] == "TEST_Updated Project Name"
        assert updated["quoted_amount"] == 120000
        assert updated["received_amount"] == 0  # Should be preserved
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_delete_project_cascades_payments(self, api_client):
        """DELETE /api/projects/{id} should remove project and its payments"""
        # Create project
        create_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Delete Project",
            "quoted_amount": 50000
        })
        project = create_resp.json()
        project_id = project["id"]
        
        # Add a payment
        api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": project_id,
            "amount": 10000
        })
        
        # Delete project
        delete_resp = api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
        assert delete_resp.status_code == 200
        
        # Verify project is gone
        get_resp = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_resp.status_code == 404
        
        # Verify payments are gone
        payments_resp = api_client.get(f"{BASE_URL}/api/payments", params={"project_id": project_id})
        assert payments_resp.status_code == 200
        assert len(payments_resp.json()) == 0


# ==================== CLIENTS CRUD ====================
class TestClientsCRUD:
    """Clients CRUD operations"""
    
    def test_list_clients_returns_seeded_data(self, api_client):
        """GET /api/clients should return 4 seeded clients"""
        response = api_client.get(f"{BASE_URL}/api/clients")
        assert response.status_code == 200
        clients = response.json()
        
        assert len(clients) == 4
        
        # Verify fields
        c = clients[0]
        assert "id" in c
        assert "name" in c
        assert "phone" in c
        assert "email" in c
        assert "company" in c
        assert "address" in c
    
    def test_create_client(self, api_client):
        """POST /api/clients should create a new client"""
        payload = {
            "name": "TEST_New Client",
            "phone": "+91 12345 67890",
            "email": "test@example.com",
            "company": "Test Company",
            "address": "Test Address"
        }
        response = api_client.post(f"{BASE_URL}/api/clients", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_New Client"
        assert data["phone"] == "+91 12345 67890"
        assert data["email"] == "test@example.com"
        assert "id" in data
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/clients/{data['id']}")
    
    def test_update_client_syncs_to_projects(self, api_client):
        """PUT /api/clients/{id} should sync client_name to linked projects"""
        # Create client
        client_resp = api_client.post(f"{BASE_URL}/api/clients", json={
            "name": "TEST_Sync Client"
        })
        client = client_resp.json()
        client_id = client["id"]
        
        # Create project with this client
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Sync Project",
            "client_id": client_id,
            "quoted_amount": 10000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Update client name
        api_client.put(f"{BASE_URL}/api/clients/{client_id}", json={
            "name": "TEST_Updated Client Name"
        })
        
        # Verify project has updated client_name
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["client_name"] == "TEST_Updated Client Name"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
        api_client.delete(f"{BASE_URL}/api/clients/{client_id}")
    
    def test_delete_client_nullifies_projects(self, api_client):
        """DELETE /api/clients/{id} should set client_id=null on linked projects"""
        # Create client
        client_resp = api_client.post(f"{BASE_URL}/api/clients", json={
            "name": "TEST_Delete Client"
        })
        client = client_resp.json()
        client_id = client["id"]
        
        # Create project with this client
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Orphan Project",
            "client_id": client_id,
            "quoted_amount": 10000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Delete client
        api_client.delete(f"{BASE_URL}/api/clients/{client_id}")
        
        # Verify project has null client
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["client_id"] is None
        assert updated_project["client_name"] == ""
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")


# ==================== ARCHITECTS CRUD ====================
class TestArchitectsCRUD:
    """Architects CRUD operations"""
    
    def test_list_architects_returns_seeded_data(self, api_client):
        """GET /api/architects should return 3 seeded architects"""
        response = api_client.get(f"{BASE_URL}/api/architects")
        assert response.status_code == 200
        architects = response.json()
        
        assert len(architects) == 3
        
        # Verify fields
        a = architects[0]
        assert "id" in a
        assert "name" in a
        assert "phone" in a
        assert "email" in a
        assert "firm" in a
    
    def test_create_architect(self, api_client):
        """POST /api/architects should create a new architect"""
        payload = {
            "name": "TEST_New Architect",
            "phone": "+91 99999 88888",
            "email": "architect@test.com",
            "firm": "Test Firm"
        }
        response = api_client.post(f"{BASE_URL}/api/architects", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "TEST_New Architect"
        assert data["firm"] == "Test Firm"
        assert "id" in data
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/architects/{data['id']}")
    
    def test_update_architect_syncs_to_projects(self, api_client):
        """PUT /api/architects/{id} should sync architect_name to linked projects"""
        # Create architect
        arch_resp = api_client.post(f"{BASE_URL}/api/architects", json={
            "name": "TEST_Sync Architect"
        })
        architect = arch_resp.json()
        arch_id = architect["id"]
        
        # Create project with this architect
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Arch Sync Project",
            "architect_id": arch_id,
            "quoted_amount": 10000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Update architect name
        api_client.put(f"{BASE_URL}/api/architects/{arch_id}", json={
            "name": "TEST_Updated Architect Name"
        })
        
        # Verify project has updated architect_name
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["architect_name"] == "TEST_Updated Architect Name"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
        api_client.delete(f"{BASE_URL}/api/architects/{arch_id}")
    
    def test_delete_architect_nullifies_projects(self, api_client):
        """DELETE /api/architects/{id} should set architect_id=null on linked projects"""
        # Create architect
        arch_resp = api_client.post(f"{BASE_URL}/api/architects", json={
            "name": "TEST_Delete Architect"
        })
        architect = arch_resp.json()
        arch_id = architect["id"]
        
        # Create project with this architect
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Orphan Arch Project",
            "architect_id": arch_id,
            "quoted_amount": 10000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Delete architect
        api_client.delete(f"{BASE_URL}/api/architects/{arch_id}")
        
        # Verify project has null architect
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["architect_id"] is None
        assert updated_project["architect_name"] == ""
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")


# ==================== PAYMENTS ====================
class TestPayments:
    """Payment recording and listing"""
    
    def test_create_payment_updates_project(self, api_client):
        """POST /api/payments should increment received_amount and update status"""
        # Create project
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Payment Project",
            "quoted_amount": 10000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Record payment
        payment_resp = api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": project_id,
            "amount": 5000,
            "notes": "First payment"
        })
        assert payment_resp.status_code == 200
        
        payment = payment_resp.json()
        assert payment["amount"] == 5000
        assert payment["project_id"] == project_id
        assert "project_code" in payment
        
        # Verify project updated
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["received_amount"] == 5000
        assert updated_project["outstanding_amount"] == 5000
        assert updated_project["status"] == "Outstanding"
        
        # Record another payment to settle
        api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": project_id,
            "amount": 5000
        })
        
        # Verify status changed to Settled
        settled_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert settled_project["received_amount"] == 10000
        assert settled_project["outstanding_amount"] == 0
        assert settled_project["status"] == "Settled"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_payment_rejects_zero_amount(self, api_client):
        """POST /api/payments should reject amount <= 0 with 400"""
        projects = api_client.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]["id"]
        
        response = api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": project_id,
            "amount": 0
        })
        assert response.status_code == 400
        
        response = api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": project_id,
            "amount": -100
        })
        assert response.status_code == 400
    
    def test_payment_rejects_unknown_project(self, api_client):
        """POST /api/payments should reject unknown project with 404"""
        response = api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": "nonexistent-id",
            "amount": 1000
        })
        assert response.status_code == 404
    
    def test_list_payments_by_project(self, api_client):
        """GET /api/payments?project_id=... should list payments sorted by date desc"""
        # Create project and payments
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_List Payments Project",
            "quoted_amount": 30000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Add multiple payments
        api_client.post(f"{BASE_URL}/api/payments", json={"project_id": project_id, "amount": 5000})
        api_client.post(f"{BASE_URL}/api/payments", json={"project_id": project_id, "amount": 10000})
        
        # List payments
        response = api_client.get(f"{BASE_URL}/api/payments", params={"project_id": project_id})
        assert response.status_code == 200
        
        payments = response.json()
        assert len(payments) == 2
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")


# ==================== EXPORT EXCEL ====================
class TestExportExcel:
    """Excel export endpoint"""
    
    def test_export_excel_returns_xlsx(self, api_client):
        """GET /api/export/excel should return .xlsx with proper headers"""
        response = api_client.get(f"{BASE_URL}/api/export/excel")
        assert response.status_code == 200
        
        # Check content type
        assert "spreadsheetml" in response.headers.get("Content-Type", "")
        
        # Check Content-Disposition header
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp
        assert ".xlsx" in content_disp
        
        # Verify it's a valid xlsx (starts with PK for zip)
        assert response.content[:2] == b'PK'


# ==================== SEED ENDPOINT ====================
class TestSeedEndpoint:
    """Seed demo data endpoint"""
    
    def test_seed_is_idempotent(self, api_client):
        """POST /api/seed should return seeded=false when data exists"""
        response = api_client.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        
        data = response.json()
        assert data["ok"] == True
        assert data["seeded"] == False  # Data already exists


# ==================== NO MONGODB _ID FIELDS ====================
class TestNoMongoDBId:
    """Verify no MongoDB _id fields in responses"""
    
    def test_projects_no_underscore_id(self, api_client):
        """Projects should not have _id field"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        projects = response.json()
        for p in projects:
            assert "_id" not in p, "Project contains _id field"
    
    def test_clients_no_underscore_id(self, api_client):
        """Clients should not have _id field"""
        response = api_client.get(f"{BASE_URL}/api/clients")
        clients = response.json()
        for c in clients:
            assert "_id" not in c, "Client contains _id field"
    
    def test_architects_no_underscore_id(self, api_client):
        """Architects should not have _id field"""
        response = api_client.get(f"{BASE_URL}/api/architects")
        architects = response.json()
        for a in architects:
            assert "_id" not in a, "Architect contains _id field"
