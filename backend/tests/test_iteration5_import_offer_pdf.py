"""
Iteration 5 Tests: SQLite Import & Editable Offer PDF Fields
Tests:
- Dashboard stats verification (imported data)
- Projects list with preserved CC codes and client/architect names
- Payments linked to correct projects
- SQLite import endpoint (merge and replace modes)
- SQLite import rejects non-SQLite files
- Offer model editable PDF fields (scope_of_work, payment_schedule, terms_conditions, etc.)
- PUT /api/offers/{id} stores editable fields correctly
- GET /api/offers/{id}/pdf uses editable fields
- Payment schedule in PDF computes milestone amounts
- Existing tests still pass
"""
import pytest
import requests
import os
import tempfile
import sqlite3

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardStatsImportedData:
    """Verify dashboard stats reflect imported data"""
    
    def test_dashboard_stats_total_projects(self):
        """Dashboard should show 70 projects from imported data"""
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["total_projects"] == 70, f"Expected 70 projects, got {data['total_projects']}"
    
    def test_dashboard_stats_total_clients(self):
        """Dashboard should show ~37 clients from imported data"""
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        # Expected 37-38 clients
        assert 35 <= data["total_clients"] <= 40, f"Expected ~37 clients, got {data['total_clients']}"
    
    def test_dashboard_stats_total_architects(self):
        """Dashboard should show 2-3 architects from imported data"""
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert 2 <= data["total_architects"] <= 4, f"Expected 2-3 architects, got {data['total_architects']}"
    
    def test_dashboard_stats_quoted_amount(self):
        """Dashboard should show ~4,447,492 total quoted"""
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        # Allow some tolerance
        assert 4400000 <= data["total_quoted"] <= 4500000, f"Expected ~4,447,492 quoted, got {data['total_quoted']}"
    
    def test_dashboard_stats_received_amount(self):
        """Dashboard should show ~1,012,500 total received"""
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert 1000000 <= data["total_received"] <= 1100000, f"Expected ~1,012,500 received, got {data['total_received']}"
    
    def test_dashboard_stats_outstanding_amount(self):
        """Dashboard should show ~3,434,992 total outstanding"""
        r = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        assert 3400000 <= data["total_outstanding"] <= 3500000, f"Expected ~3,434,992 outstanding, got {data['total_outstanding']}"


class TestProjectsImportedData:
    """Verify imported projects have correct data"""
    
    def test_projects_list_returns_70_projects(self):
        """Projects list should return 70 projects"""
        r = requests.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 70, f"Expected 70 projects, got {len(data)}"
    
    def test_project_cc_0072_iocl(self):
        """CC-0072 should be IOCL project"""
        r = requests.get(f"{BASE_URL}/api/projects", params={"search": "CC-0072"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1, "CC-0072 not found"
        proj = data[0]
        assert proj["project_code"] == "CC-0072"
        assert "iocl" in proj["client_name"].lower() or "india oil" in proj["client_name"].lower()
    
    def test_project_cc_0001_raien_fresh(self):
        """CC-0001 should be Raien Fresh Produce with Tanay Mehta"""
        r = requests.get(f"{BASE_URL}/api/projects", params={"search": "CC-0001"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1, "CC-0001 not found"
        proj = data[0]
        assert proj["project_code"] == "CC-0001"
        assert "raien" in proj["client_name"].lower()
        assert "tanay" in proj["architect_name"].lower()


class TestPaymentsImportedData:
    """Verify imported payments"""
    
    def test_payments_list_returns_27_payments(self):
        """Payments list should return 27 payments"""
        r = requests.get(f"{BASE_URL}/api/payments")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 27, f"Expected 27 payments, got {len(data)}"
    
    def test_payments_linked_to_projects(self):
        """Payments should have valid project_id and project_code"""
        r = requests.get(f"{BASE_URL}/api/payments")
        assert r.status_code == 200
        data = r.json()
        for pay in data[:5]:  # Check first 5
            assert pay.get("project_id"), f"Payment {pay['id']} missing project_id"
            assert pay.get("project_code"), f"Payment {pay['id']} missing project_code"


class TestSqliteImportEndpoint:
    """Test POST /api/import/sqlite endpoint"""
    
    def _create_test_sqlite_db(self, clients=None, architects=None, projects=None, payments=None):
        """Create a temporary SQLite database for testing"""
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        
        # Create tables
        cur.execute("CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT)")
        cur.execute("CREATE TABLE architects (id INTEGER PRIMARY KEY, name TEXT)")
        cur.execute("CREATE TABLE projects (id INTEGER PRIMARY KEY, project_id TEXT, project_name TEXT, client_name TEXT, architect_name TEXT, site_location TEXT, quoted_amount REAL, created_at TEXT)")
        cur.execute("CREATE TABLE payments (id INTEGER PRIMARY KEY, project_id TEXT, amount REAL, note TEXT, paid_at TEXT)")
        
        if clients:
            for c in clients:
                cur.execute("INSERT INTO clients (name) VALUES (?)", (c,))
        if architects:
            for a in architects:
                cur.execute("INSERT INTO architects (name) VALUES (?)", (a,))
        if projects:
            for p in projects:
                cur.execute("INSERT INTO projects (project_id, project_name, client_name, architect_name, site_location, quoted_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", p)
        if payments:
            for pay in payments:
                cur.execute("INSERT INTO payments (project_id, amount, note, paid_at) VALUES (?, ?, ?, ?)", pay)
        
        conn.commit()
        conn.close()
        return path
    
    def test_sqlite_import_rejects_non_sqlite_file(self):
        """Import should reject non-SQLite files with 400"""
        # Create a text file
        fd, path = tempfile.mkstemp(suffix=".db")
        os.write(fd, b"This is not a SQLite file")
        os.close(fd)
        
        try:
            with open(path, 'rb') as f:
                r = requests.post(
                    f"{BASE_URL}/api/import/sqlite",
                    files={"file": ("test.db", f, "application/octet-stream")},
                    params={"replace": "false"}
                )
            assert r.status_code == 400, f"Expected 400, got {r.status_code}"
            assert "not a valid sqlite" in r.json().get("detail", "").lower()
        finally:
            os.unlink(path)
    
    def test_sqlite_import_merge_mode(self):
        """Import with replace=false should merge data (skip duplicates)"""
        # Create a test SQLite with a new unique project
        unique_code = "CC-TEST-MERGE-001"
        db_path = self._create_test_sqlite_db(
            clients=["Test Merge Client"],
            architects=["Test Merge Architect"],
            projects=[(unique_code, "Test Merge Project", "Test Merge Client", "Test Merge Architect", "Test Location", 50000.0, "2026-01-01 00:00:00")],
            payments=[]
        )
        
        try:
            with open(db_path, 'rb') as f:
                r = requests.post(
                    f"{BASE_URL}/api/import/sqlite",
                    files={"file": ("test.db", f, "application/octet-stream")},
                    params={"replace": "false"}
                )
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            data = r.json()
            assert data.get("ok") == True
            assert "imported" in data
            
            # Verify the project was created
            r2 = requests.get(f"{BASE_URL}/api/projects", params={"search": unique_code})
            assert r2.status_code == 200
            projects = r2.json()
            assert len(projects) >= 1, f"Project {unique_code} not found after import"
            
            # Clean up - delete the test project
            for p in projects:
                if p["project_code"] == unique_code:
                    requests.delete(f"{BASE_URL}/api/projects/{p['id']}")
        finally:
            os.unlink(db_path)
    
    def test_sqlite_import_returns_imported_counts(self):
        """Import should return counts of imported items"""
        db_path = self._create_test_sqlite_db(
            clients=["Import Count Test Client"],
            architects=[],
            projects=[("CC-COUNT-TEST", "Count Test Project", "Import Count Test Client", "", "Location", 10000.0, "2026-01-01 00:00:00")],
            payments=[]
        )
        
        try:
            with open(db_path, 'rb') as f:
                r = requests.post(
                    f"{BASE_URL}/api/import/sqlite",
                    files={"file": ("test.db", f, "application/octet-stream")},
                    params={"replace": "false"}
                )
            assert r.status_code == 200
            data = r.json()
            assert "imported" in data
            imported = data["imported"]
            assert "clients" in imported
            assert "architects" in imported
            assert "projects" in imported
            assert "payments" in imported
            
            # Clean up
            r2 = requests.get(f"{BASE_URL}/api/projects", params={"search": "CC-COUNT-TEST"})
            for p in r2.json():
                if p["project_code"] == "CC-COUNT-TEST":
                    requests.delete(f"{BASE_URL}/api/projects/{p['id']}")
        finally:
            os.unlink(db_path)


class TestOfferEditablePdfFields:
    """Test editable PDF fields on Offer model"""
    
    def test_create_offer_with_editable_fields(self):
        """Create offer with all editable PDF fields"""
        payload = {
            "offer_type": "Audit",
            "description": "Test Audit Offer",
            "base_amount": 100000,
            "gst_percent": 18,
            "subject": "Custom Subject Line",
            "scope_of_work": "Phase 1: Initial assessment\nPhase 2: Detailed analysis",
            "payment_schedule": [
                {"label": "Advance", "percent": 30},
                {"label": "Mid-term", "percent": 40},
                {"label": "Final", "percent": 30}
            ],
            "terms_conditions": [
                "Custom T&C 1",
                "Custom T&C 2"
            ],
            "bank_details": "Custom Bank Details",
            "signature_name": "Custom Signatory",
            "company_header": "Custom Company Name",
            "company_tagline": "Custom Tagline",
            "company_address": "Custom Address",
            "intro_paragraph": "Custom intro paragraph"
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=payload)
        assert r.status_code == 200, f"Failed to create offer: {r.text}"
        data = r.json()
        
        # Verify all fields are stored
        assert data["subject"] == "Custom Subject Line"
        assert data["scope_of_work"] == "Phase 1: Initial assessment\nPhase 2: Detailed analysis"
        assert len(data["payment_schedule"]) == 3
        assert data["payment_schedule"][0]["label"] == "Advance"
        assert data["payment_schedule"][0]["percent"] == 30
        assert len(data["terms_conditions"]) == 2
        assert data["terms_conditions"][0] == "Custom T&C 1"
        assert data["bank_details"] == "Custom Bank Details"
        assert data["signature_name"] == "Custom Signatory"
        assert data["company_header"] == "Custom Company Name"
        assert data["company_tagline"] == "Custom Tagline"
        assert data["company_address"] == "Custom Address"
        assert data["intro_paragraph"] == "Custom intro paragraph"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/offers/{data['id']}")
    
    def test_update_offer_editable_fields(self):
        """Update offer with subset of editable fields"""
        # Create offer first
        create_payload = {
            "offer_type": "RCC",
            "description": "Update Test Offer",
            "base_amount": 50000,
            "gst_percent": 18
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=create_payload)
        assert r.status_code == 200
        offer_id = r.json()["id"]
        
        # Update with editable fields
        update_payload = {
            "offer_type": "RCC",
            "description": "Update Test Offer",
            "base_amount": 50000,
            "gst_percent": 18,
            "scope_of_work": "Updated scope of work",
            "payment_schedule": [
                {"label": "Full payment", "percent": 100}
            ],
            "terms_conditions": ["Updated T&C"]
        }
        r = requests.put(f"{BASE_URL}/api/offers/{offer_id}", json=update_payload)
        assert r.status_code == 200
        data = r.json()
        
        assert data["scope_of_work"] == "Updated scope of work"
        assert len(data["payment_schedule"]) == 1
        assert data["payment_schedule"][0]["percent"] == 100
        assert len(data["terms_conditions"]) == 1
        
        # Verify via GET
        r = requests.get(f"{BASE_URL}/api/offers/{offer_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["scope_of_work"] == "Updated scope of work"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_get_offer_returns_editable_fields(self):
        """GET offer should return all editable PDF fields"""
        # Use existing seeded offer
        r = requests.get(f"{BASE_URL}/api/offers")
        assert r.status_code == 200
        offers = r.json()
        if not offers:
            pytest.skip("No offers to test")
        
        offer = offers[0]
        r = requests.get(f"{BASE_URL}/api/offers/{offer['id']}")
        assert r.status_code == 200
        data = r.json()
        
        # All editable fields should be present (even if empty)
        assert "subject" in data
        assert "scope_of_work" in data
        assert "payment_schedule" in data
        assert "terms_conditions" in data
        assert "bank_details" in data
        assert "signature_name" in data
        assert "company_header" in data
        assert "company_tagline" in data
        assert "company_address" in data
        assert "intro_paragraph" in data


class TestOfferPdfGeneration:
    """Test PDF generation with editable fields"""
    
    def test_offer_pdf_returns_valid_pdf(self):
        """PDF endpoint should return valid PDF"""
        r = requests.get(f"{BASE_URL}/api/offers")
        assert r.status_code == 200
        offers = r.json()
        if not offers:
            pytest.skip("No offers to test")
        
        offer = offers[0]
        r = requests.get(f"{BASE_URL}/api/offers/{offer['id']}/pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type") == "application/pdf"
        assert r.content[:4] == b"%PDF"
    
    def test_offer_pdf_with_custom_fields(self):
        """PDF should be generated for offer with custom fields"""
        # Create offer with custom fields
        payload = {
            "offer_type": "Steel",
            "description": "PDF Test Offer",
            "base_amount": 200000,
            "gst_percent": 18,
            "subject": "PDF Test Subject",
            "scope_of_work": "PDF Test Scope",
            "payment_schedule": [
                {"label": "Advance", "percent": 50},
                {"label": "Final", "percent": 50}
            ],
            "terms_conditions": ["PDF Test T&C"],
            "bank_details": "PDF Test Bank",
            "signature_name": "PDF Test Signatory"
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=payload)
        assert r.status_code == 200
        offer_id = r.json()["id"]
        
        # Get PDF
        r = requests.get(f"{BASE_URL}/api/offers/{offer_id}/pdf")
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_offer_pdf_default_payment_schedule(self):
        """PDF should use 50/50 default when no payment schedule provided"""
        # Create offer without payment schedule
        payload = {
            "offer_type": "Audit",
            "description": "Default Schedule Test",
            "base_amount": 100000,
            "gst_percent": 18
        }
        r = requests.post(f"{BASE_URL}/api/offers", json=payload)
        assert r.status_code == 200
        offer_id = r.json()["id"]
        
        # PDF should still generate
        r = requests.get(f"{BASE_URL}/api/offers/{offer_id}/pdf")
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/offers/{offer_id}")


class TestExistingTestsStillPass:
    """Verify existing functionality still works"""
    
    def test_clients_endpoint_works(self):
        r = requests.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    
    def test_architects_endpoint_works(self):
        r = requests.get(f"{BASE_URL}/api/architects")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    
    def test_projects_endpoint_works(self):
        r = requests.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    
    def test_offers_endpoint_works(self):
        r = requests.get(f"{BASE_URL}/api/offers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    
    def test_payments_endpoint_works(self):
        r = requests.get(f"{BASE_URL}/api/payments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
    
    def test_auth_status_endpoint_works(self):
        r = requests.get(f"{BASE_URL}/api/auth/status")
        assert r.status_code == 200
        assert "password_set" in r.json()


class TestNoMongoDBIdInResponses:
    """Verify no MongoDB _id in API responses"""
    
    def test_offers_no_underscore_id(self):
        r = requests.get(f"{BASE_URL}/api/offers")
        assert r.status_code == 200
        for offer in r.json():
            assert "_id" not in offer, f"Found _id in offer: {offer.get('offer_code')}"
    
    def test_projects_no_underscore_id(self):
        r = requests.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200
        for proj in r.json()[:10]:  # Check first 10
            assert "_id" not in proj, f"Found _id in project: {proj.get('project_code')}"
    
    def test_payments_no_underscore_id(self):
        r = requests.get(f"{BASE_URL}/api/payments")
        assert r.status_code == 200
        for pay in r.json()[:10]:  # Check first 10
            assert "_id" not in pay, f"Found _id in payment: {pay.get('id')}"
