"""
Creator Consultant API Tests - Iteration 2 Features
Tests for PDF Invoice/Receipt generation and Archive (soft-delete) functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== PDF INVOICE GENERATION ====================
class TestPDFInvoice:
    """Project Invoice PDF endpoint tests"""
    
    def test_invoice_returns_valid_pdf(self, api_client):
        """GET /api/projects/{id}/invoice should return valid PDF with correct headers"""
        # Get first project
        projects = api_client.get(f"{BASE_URL}/api/projects").json()
        assert len(projects) > 0, "No projects found for testing"
        project = projects[0]
        project_id = project["id"]
        project_code = project["project_code"]
        
        response = api_client.get(f"{BASE_URL}/api/projects/{project_id}/invoice")
        assert response.status_code == 200
        
        # Check content type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        # Check Content-Disposition has attachment with filename containing project_code
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Missing attachment in Content-Disposition"
        assert project_code in content_disp, f"Filename should contain {project_code}"
        assert ".pdf" in content_disp, "Filename should have .pdf extension"
        
        # Verify PDF magic bytes (%PDF)
        assert response.content[:4] == b'%PDF', "Response does not start with %PDF"
    
    def test_invoice_unknown_project_returns_404(self, api_client):
        """GET /api/projects/{unknown_id}/invoice should return 404"""
        response = api_client.get(f"{BASE_URL}/api/projects/nonexistent-id/invoice")
        assert response.status_code == 404


# ==================== PDF RECEIPT GENERATION ====================
class TestPDFReceipt:
    """Payment Receipt PDF endpoint tests"""
    
    def test_receipt_returns_valid_pdf(self, api_client):
        """GET /api/payments/{id}/receipt should return valid PDF with correct headers"""
        # Create a project and payment for testing
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Receipt Project",
            "quoted_amount": 50000
        })
        project = project_resp.json()
        project_id = project["id"]
        project_code = project["project_code"]
        
        # Create a payment
        payment_resp = api_client.post(f"{BASE_URL}/api/payments", json={
            "project_id": project_id,
            "amount": 10000,
            "notes": "Test payment for receipt"
        })
        assert payment_resp.status_code == 200
        payment = payment_resp.json()
        payment_id = payment["id"]
        
        # Get receipt PDF
        response = api_client.get(f"{BASE_URL}/api/payments/{payment_id}/receipt")
        assert response.status_code == 200
        
        # Check content type is PDF
        content_type = response.headers.get("Content-Type", "")
        assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
        
        # Check Content-Disposition has attachment
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Missing attachment in Content-Disposition"
        assert project_code in content_disp, f"Filename should contain {project_code}"
        assert ".pdf" in content_disp, "Filename should have .pdf extension"
        
        # Verify PDF magic bytes (%PDF)
        assert response.content[:4] == b'%PDF', "Response does not start with %PDF"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_receipt_unknown_payment_returns_404(self, api_client):
        """GET /api/payments/{unknown_id}/receipt should return 404"""
        response = api_client.get(f"{BASE_URL}/api/payments/nonexistent-id/receipt")
        assert response.status_code == 404


# ==================== ARCHIVE FUNCTIONALITY ====================
class TestArchiveProject:
    """Project archive (soft-delete) endpoint tests"""
    
    def test_archive_project_sets_archived_true(self, api_client):
        """POST /api/projects/{id}/archive should set archived=true"""
        # Create a project
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Archive Project",
            "quoted_amount": 25000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Archive the project
        archive_resp = api_client.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        assert archive_resp.status_code == 200
        data = archive_resp.json()
        assert data["ok"] == True
        assert data["archived"] == True
        
        # Verify project is archived
        get_resp = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["archived"] == True
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_unarchive_project_sets_archived_false(self, api_client):
        """POST /api/projects/{id}/unarchive should set archived=false"""
        # Create and archive a project
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Unarchive Project",
            "quoted_amount": 30000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Archive first
        api_client.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        
        # Unarchive
        unarchive_resp = api_client.post(f"{BASE_URL}/api/projects/{project_id}/unarchive")
        assert unarchive_resp.status_code == 200
        data = unarchive_resp.json()
        assert data["ok"] == True
        assert data["archived"] == False
        
        # Verify project is not archived
        get_resp = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["archived"] == False
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_archive_unknown_project_returns_404(self, api_client):
        """POST /api/projects/{unknown_id}/archive should return 404"""
        response = api_client.post(f"{BASE_URL}/api/projects/nonexistent-id/archive")
        assert response.status_code == 404
    
    def test_unarchive_unknown_project_returns_404(self, api_client):
        """POST /api/projects/{unknown_id}/unarchive should return 404"""
        response = api_client.post(f"{BASE_URL}/api/projects/nonexistent-id/unarchive")
        assert response.status_code == 404


# ==================== ARCHIVE FILTERING ====================
class TestArchiveFiltering:
    """Project list filtering by archive status"""
    
    def test_default_list_excludes_archived(self, api_client):
        """GET /api/projects (default) should exclude archived projects"""
        # Create and archive a project
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Hidden Archived Project",
            "quoted_amount": 15000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Archive it
        api_client.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        
        # Default list should NOT include archived project
        list_resp = api_client.get(f"{BASE_URL}/api/projects")
        assert list_resp.status_code == 200
        projects = list_resp.json()
        
        project_ids = [p["id"] for p in projects]
        assert project_id not in project_ids, "Archived project should not appear in default list"
        
        # Verify all returned projects are not archived
        for p in projects:
            assert p.get("archived", False) == False, f"Project {p['project_code']} should not be archived"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_archived_only_returns_only_archived(self, api_client):
        """GET /api/projects?archived_only=true should return ONLY archived projects"""
        # Create and archive a project
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Only Archived Project",
            "quoted_amount": 20000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Archive it
        api_client.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        
        # archived_only=true should include this project
        list_resp = api_client.get(f"{BASE_URL}/api/projects", params={"archived_only": "true"})
        assert list_resp.status_code == 200
        projects = list_resp.json()
        
        # Should contain our archived project
        project_ids = [p["id"] for p in projects]
        assert project_id in project_ids, "Archived project should appear in archived_only list"
        
        # All returned projects should be archived
        for p in projects:
            assert p.get("archived", False) == True, f"Project {p['project_code']} should be archived"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_include_archived_returns_both(self, api_client):
        """GET /api/projects?include_archived=true should return both archived and active"""
        # Create two projects - one active, one archived
        active_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Active Project",
            "quoted_amount": 10000
        })
        active_project = active_resp.json()
        active_id = active_project["id"]
        
        archived_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Archived Project",
            "quoted_amount": 12000
        })
        archived_project = archived_resp.json()
        archived_id = archived_project["id"]
        
        # Archive one
        api_client.post(f"{BASE_URL}/api/projects/{archived_id}/archive")
        
        # include_archived=true should include both
        list_resp = api_client.get(f"{BASE_URL}/api/projects", params={"include_archived": "true"})
        assert list_resp.status_code == 200
        projects = list_resp.json()
        
        project_ids = [p["id"] for p in projects]
        assert active_id in project_ids, "Active project should appear in include_archived list"
        assert archived_id in project_ids, "Archived project should appear in include_archived list"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{active_id}")
        api_client.delete(f"{BASE_URL}/api/projects/{archived_id}")
    
    def test_search_respects_archived_filter(self, api_client):
        """GET /api/projects?search=... should respect archived filter (exclude by default)"""
        # Create and archive a project with unique name
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_UniqueSearchArchived999",
            "quoted_amount": 8000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Archive it
        api_client.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        
        # Search without archived flag should NOT find it
        search_resp = api_client.get(f"{BASE_URL}/api/projects", params={"search": "UniqueSearchArchived999"})
        assert search_resp.status_code == 200
        projects = search_resp.json()
        
        project_ids = [p["id"] for p in projects]
        assert project_id not in project_ids, "Archived project should not appear in search results by default"
        
        # Search with archived_only should find it
        search_archived_resp = api_client.get(f"{BASE_URL}/api/projects", params={
            "search": "UniqueSearchArchived999",
            "archived_only": "true"
        })
        assert search_archived_resp.status_code == 200
        archived_projects = search_archived_resp.json()
        
        archived_ids = [p["id"] for p in archived_projects]
        assert project_id in archived_ids, "Archived project should appear in archived_only search"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")


# ==================== ARCHIVED FIELD IN RESPONSE ====================
class TestArchivedFieldInResponse:
    """Verify archived field is present in project responses"""
    
    def test_project_has_archived_field(self, api_client):
        """Projects should have archived field (default false)"""
        # Create a new project
        project_resp = api_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Archived Field Project",
            "quoted_amount": 5000
        })
        project = project_resp.json()
        project_id = project["id"]
        
        # Verify archived field exists and is false by default
        assert "archived" in project, "Project response should have archived field"
        assert project["archived"] == False, "New project should have archived=false"
        
        # Verify in GET single project
        get_resp = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_resp.status_code == 200
        assert "archived" in get_resp.json()
        
        # Verify in list
        list_resp = api_client.get(f"{BASE_URL}/api/projects")
        assert list_resp.status_code == 200
        for p in list_resp.json():
            assert "archived" in p, f"Project {p['project_code']} missing archived field"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
