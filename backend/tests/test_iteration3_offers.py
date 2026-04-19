"""
Creator Consultant API Tests - Iteration 3: Offers Module
Tests for Offers CRUD, GST calculations, effective_type logic, convert-to-project, and project linkage
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


# ==================== OFFERS LIST & FILTERING ====================
class TestOffersListAndFilter:
    """Offers list endpoint with filtering and search"""
    
    def test_list_offers_returns_seeded_data(self, api_client):
        """GET /api/offers should return seeded offers with computed fields"""
        response = api_client.get(f"{BASE_URL}/api/offers")
        assert response.status_code == 200
        offers = response.json()
        
        # Should have at least 3 seeded offers
        assert len(offers) >= 3, f"Expected at least 3 offers, got {len(offers)}"
        
        # Verify required fields on first offer
        o = offers[0]
        required_fields = [
            "id", "offer_code", "offer_type", "custom_type", "effective_type",
            "client_id", "client_name", "client_phone", "client_email",
            "description", "site_location", "base_amount", "gst_percent",
            "gst_amount", "total_amount", "file_path", "status",
            "offer_date", "reference_no", "notes", "linked_project_id",
            "linked_project_code", "created_at"
        ]
        for field in required_fields:
            assert field in o, f"Missing field: {field}"
    
    def test_offers_gst_calculation_correct(self, api_client):
        """Verify GST amount and total_amount are computed correctly"""
        response = api_client.get(f"{BASE_URL}/api/offers")
        offers = response.json()
        
        for o in offers:
            expected_gst = round(o["base_amount"] * o["gst_percent"] / 100.0, 2)
            expected_total = round(o["base_amount"] + expected_gst, 2)
            
            assert abs(o["gst_amount"] - expected_gst) < 0.01, \
                f"GST mismatch for {o['offer_code']}: expected {expected_gst}, got {o['gst_amount']}"
            assert abs(o["total_amount"] - expected_total) < 0.01, \
                f"Total mismatch for {o['offer_code']}: expected {expected_total}, got {o['total_amount']}"
    
    def test_offers_effective_type_logic(self, api_client):
        """Verify effective_type: uses custom_type when offer_type is 'Other', else offer_type"""
        response = api_client.get(f"{BASE_URL}/api/offers")
        offers = response.json()
        
        for o in offers:
            if o["offer_type"].lower() == "other":
                assert o["effective_type"] == o["custom_type"], \
                    f"For 'Other' type, effective_type should be custom_type. Got {o['effective_type']}"
            else:
                assert o["effective_type"] == o["offer_type"], \
                    f"For non-Other type, effective_type should be offer_type. Got {o['effective_type']}"
    
    def test_filter_offers_by_status_pending(self, api_client):
        """GET /api/offers?status=Pending should filter by status"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"status": "Pending"})
        assert response.status_code == 200
        offers = response.json()
        
        for o in offers:
            assert o["status"] == "Pending", f"Expected Pending status, got {o['status']}"
    
    def test_filter_offers_by_status_accepted(self, api_client):
        """GET /api/offers?status=Accepted should filter by status"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"status": "Accepted"})
        assert response.status_code == 200
        offers = response.json()
        
        for o in offers:
            assert o["status"] == "Accepted", f"Expected Accepted status, got {o['status']}"
    
    def test_search_offers_by_offer_code(self, api_client):
        """GET /api/offers?search=OFR-0001 should find by offer_code"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "OFR-0001"})
        assert response.status_code == 200
        offers = response.json()
        
        assert len(offers) >= 1, "Should find at least one offer"
        assert any(o["offer_code"] == "OFR-0001" for o in offers)
    
    def test_search_offers_by_reference_no(self, api_client):
        """GET /api/offers?search=STR/AUDIT should find by reference_no"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "STR/AUDIT"})
        assert response.status_code == 200
        offers = response.json()
        
        assert len(offers) >= 1, "Should find at least one offer"
        assert any("STR/AUDIT" in (o.get("reference_no") or "") for o in offers)
    
    def test_search_offers_by_description(self, api_client):
        """GET /api/offers?search=... should search in description"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "Structural Design"})
        assert response.status_code == 200
        offers = response.json()
        
        assert len(offers) >= 1, "Should find at least one offer"
    
    def test_search_offers_by_site_location(self, api_client):
        """GET /api/offers?search=... should search in site_location"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "Rabale"})
        assert response.status_code == 200
        offers = response.json()
        
        assert len(offers) >= 1, "Should find at least one offer"


# ==================== OFFERS CRUD ====================
class TestOffersCRUD:
    """Offers Create, Read, Update, Delete operations"""
    
    def test_create_offer_auto_generates_code(self, api_client):
        """POST /api/offers should auto-generate sequential offer_code"""
        # Get clients for client_id
        clients = api_client.get(f"{BASE_URL}/api/clients").json()
        client_id = clients[0]["id"] if clients else None
        
        payload = {
            "offer_type": "RCC",
            "client_id": client_id,
            "description": "TEST_New RCC Offer",
            "site_location": "Test Location",
            "base_amount": 50000,
            "gst_percent": 18,
            "file_path": "D:\\Test\\offer.pdf",
            "status": "Pending",
            "reference_no": "TEST/REF/001",
            "notes": "Test notes"
        }
        response = api_client.post(f"{BASE_URL}/api/offers", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["offer_code"].startswith("OFR-"), f"Expected OFR-XXXX, got {data['offer_code']}"
        assert data["offer_type"] == "RCC"
        assert data["effective_type"] == "RCC"
        assert data["base_amount"] == 50000
        assert data["gst_amount"] == 9000  # 50000 * 18%
        assert data["total_amount"] == 59000  # 50000 + 9000
        assert data["status"] == "Pending"
        assert data["linked_project_id"] is None
        assert data["linked_project_code"] == ""
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/offers/{data['id']}")
    
    def test_create_offer_with_other_type(self, api_client):
        """POST /api/offers with offer_type='Other' should use custom_type as effective_type"""
        payload = {
            "offer_type": "Other",
            "custom_type": "Peer Review",
            "description": "TEST_Custom Type Offer",
            "base_amount": 25000,
            "gst_percent": 18
        }
        response = api_client.post(f"{BASE_URL}/api/offers", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["offer_type"] == "Other"
        assert data["custom_type"] == "Peer Review"
        assert data["effective_type"] == "Peer Review"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/offers/{data['id']}")
    
    def test_get_single_offer(self, api_client):
        """GET /api/offers/{id} should return enriched offer"""
        offers = api_client.get(f"{BASE_URL}/api/offers").json()
        offer_id = offers[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/offers/{offer_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == offer_id
        assert "client_name" in data
        assert "gst_amount" in data
        assert "total_amount" in data
        assert "effective_type" in data
    
    def test_get_nonexistent_offer_returns_404(self, api_client):
        """GET /api/offers/{invalid_id} should return 404"""
        response = api_client.get(f"{BASE_URL}/api/offers/nonexistent-id")
        assert response.status_code == 404
    
    def test_update_offer(self, api_client):
        """PUT /api/offers/{id} should update offer fields"""
        # Create an offer
        create_resp = api_client.post(f"{BASE_URL}/api/offers", json={
            "offer_type": "Steel",
            "description": "TEST_Update Offer",
            "base_amount": 100000,
            "gst_percent": 18
        })
        offer = create_resp.json()
        offer_id = offer["id"]
        
        # Update the offer
        update_resp = api_client.put(f"{BASE_URL}/api/offers/{offer_id}", json={
            "offer_type": "Steel",
            "description": "TEST_Updated Offer Description",
            "base_amount": 120000,
            "gst_percent": 18,
            "file_path": "D:\\Updated\\path.pdf"
        })
        assert update_resp.status_code == 200
        
        updated = update_resp.json()
        assert updated["description"] == "TEST_Updated Offer Description"
        assert updated["base_amount"] == 120000
        assert updated["gst_amount"] == 21600  # 120000 * 18%
        assert updated["total_amount"] == 141600
        assert updated["file_path"] == "D:\\Updated\\path.pdf"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_delete_offer(self, api_client):
        """DELETE /api/offers/{id} should remove offer"""
        # Create an offer
        create_resp = api_client.post(f"{BASE_URL}/api/offers", json={
            "offer_type": "Audit",
            "description": "TEST_Delete Offer",
            "base_amount": 30000,
            "gst_percent": 18
        })
        offer = create_resp.json()
        offer_id = offer["id"]
        
        # Delete the offer
        delete_resp = api_client.delete(f"{BASE_URL}/api/offers/{offer_id}")
        assert delete_resp.status_code == 200
        assert delete_resp.json()["ok"] == True
        
        # Verify offer is gone
        get_resp = api_client.get(f"{BASE_URL}/api/offers/{offer_id}")
        assert get_resp.status_code == 404
    
    def test_delete_nonexistent_offer_returns_404(self, api_client):
        """DELETE /api/offers/{invalid_id} should return 404"""
        response = api_client.delete(f"{BASE_URL}/api/offers/nonexistent-id")
        assert response.status_code == 404


# ==================== CONVERT OFFER TO PROJECT ====================
class TestConvertOfferToProject:
    """Convert offer to project functionality"""
    
    def test_convert_offer_creates_project(self, api_client):
        """POST /api/offers/{id}/convert-to-project should create a project"""
        # Get clients for client_id
        clients = api_client.get(f"{BASE_URL}/api/clients").json()
        client_id = clients[0]["id"] if clients else None
        
        # Create an offer
        create_resp = api_client.post(f"{BASE_URL}/api/offers", json={
            "offer_type": "RCC",
            "client_id": client_id,
            "description": "TEST_Convert Offer",
            "site_location": "Test Site",
            "base_amount": 80000,
            "gst_percent": 18,
            "file_path": "D:\\Test\\convert.pdf",
            "notes": "Test conversion notes"
        })
        offer = create_resp.json()
        offer_id = offer["id"]
        offer_code = offer["offer_code"]
        
        # Convert to project
        convert_resp = api_client.post(f"{BASE_URL}/api/offers/{offer_id}/convert-to-project")
        assert convert_resp.status_code == 200
        
        project = convert_resp.json()
        
        # Verify project fields
        assert "id" in project
        assert project["project_code"].startswith("CC-")
        assert project["quoted_amount"] == offer["total_amount"]  # GST inclusive
        assert project["client_id"] == client_id
        assert project["site_location"] == "Test Site"
        assert project["notes"] == "Test conversion notes"
        assert project["offer_id"] == offer_id
        assert project["offer_code"] == offer_code
        assert project["offer_type"] == "RCC"  # effective_type
        assert project["offer_file_path"] == "D:\\Test\\convert.pdf"
        assert project["status"] == "Outstanding"
        assert project["received_amount"] == 0
        
        # Verify offer is now Accepted and linked
        updated_offer = api_client.get(f"{BASE_URL}/api/offers/{offer_id}").json()
        assert updated_offer["status"] == "Accepted"
        assert updated_offer["linked_project_id"] == project["id"]
        assert updated_offer["linked_project_code"] == project["project_code"]
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project['id']}")
        api_client.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_convert_already_converted_offer_returns_400(self, api_client):
        """POST /api/offers/{id}/convert-to-project on already converted offer returns 400"""
        # Create and convert an offer
        create_resp = api_client.post(f"{BASE_URL}/api/offers", json={
            "offer_type": "Steel",
            "description": "TEST_Already Converted",
            "base_amount": 50000,
            "gst_percent": 18
        })
        offer = create_resp.json()
        offer_id = offer["id"]
        
        # Convert first time
        convert_resp = api_client.post(f"{BASE_URL}/api/offers/{offer_id}/convert-to-project")
        assert convert_resp.status_code == 200
        project = convert_resp.json()
        
        # Try to convert again
        second_convert = api_client.post(f"{BASE_URL}/api/offers/{offer_id}/convert-to-project")
        assert second_convert.status_code == 400
        assert "already converted" in second_convert.json().get("detail", "").lower()
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project['id']}")
        api_client.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_convert_nonexistent_offer_returns_404(self, api_client):
        """POST /api/offers/{invalid_id}/convert-to-project returns 404"""
        response = api_client.post(f"{BASE_URL}/api/offers/nonexistent-id/convert-to-project")
        assert response.status_code == 404


# ==================== PROJECT OFFER LINKAGE ====================
class TestProjectOfferLinkage:
    """Verify project has offer fields when created from offer"""
    
    def test_project_has_offer_fields(self, api_client):
        """Projects should have offer_id, offer_code, offer_type, offer_file_path fields"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        projects = response.json()
        
        # All projects should have these fields (empty string when no offer)
        for p in projects:
            assert "offer_id" in p, f"Project {p['project_code']} missing offer_id"
            assert "offer_code" in p, f"Project {p['project_code']} missing offer_code"
            assert "offer_type" in p, f"Project {p['project_code']} missing offer_type"
            assert "offer_file_path" in p, f"Project {p['project_code']} missing offer_file_path"
    
    def test_update_offer_syncs_to_linked_project(self, api_client):
        """PUT /api/offers/{id} should sync offer_type and file_path to linked project"""
        # Create and convert an offer
        create_resp = api_client.post(f"{BASE_URL}/api/offers", json={
            "offer_type": "Audit",
            "description": "TEST_Sync Offer",
            "base_amount": 40000,
            "gst_percent": 18,
            "file_path": "D:\\Original\\path.pdf"
        })
        offer = create_resp.json()
        offer_id = offer["id"]
        
        # Convert to project
        convert_resp = api_client.post(f"{BASE_URL}/api/offers/{offer_id}/convert-to-project")
        project = convert_resp.json()
        project_id = project["id"]
        
        # Update offer file_path
        api_client.put(f"{BASE_URL}/api/offers/{offer_id}", json={
            "offer_type": "Audit",
            "description": "TEST_Sync Offer",
            "base_amount": 40000,
            "gst_percent": 18,
            "file_path": "D:\\Updated\\new_path.pdf"
        })
        
        # Verify project has updated file_path
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["offer_file_path"] == "D:\\Updated\\new_path.pdf"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")
        api_client.delete(f"{BASE_URL}/api/offers/{offer_id}")
    
    def test_delete_offer_clears_project_linkage(self, api_client):
        """DELETE /api/offers/{id} should clear offer linkage on linked project"""
        # Create and convert an offer
        create_resp = api_client.post(f"{BASE_URL}/api/offers", json={
            "offer_type": "PMC",
            "custom_type": "",
            "description": "TEST_Delete Linkage Offer",
            "base_amount": 60000,
            "gst_percent": 18,
            "file_path": "D:\\Test\\delete_link.pdf"
        })
        offer = create_resp.json()
        offer_id = offer["id"]
        
        # Convert to project
        convert_resp = api_client.post(f"{BASE_URL}/api/offers/{offer_id}/convert-to-project")
        project = convert_resp.json()
        project_id = project["id"]
        
        # Verify project has offer linkage
        assert project["offer_id"] == offer_id
        assert project["offer_code"] != ""
        
        # Delete the offer
        api_client.delete(f"{BASE_URL}/api/offers/{offer_id}")
        
        # Verify project linkage is cleared
        updated_project = api_client.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated_project["offer_id"] is None
        assert updated_project["offer_code"] == ""
        assert updated_project["offer_type"] == ""
        assert updated_project["offer_file_path"] == ""
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/projects/{project_id}")


# ==================== DASHBOARD STATS WITH OFFERS ====================
class TestDashboardStatsWithOffers:
    """Dashboard stats should include offer counts"""
    
    def test_dashboard_includes_offer_counts(self, api_client):
        """GET /api/dashboard/stats should include total_offers and pending_offers"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total_offers" in data, "Missing total_offers in dashboard stats"
        assert "pending_offers" in data, "Missing pending_offers in dashboard stats"
        
        # Verify counts are non-negative integers
        assert isinstance(data["total_offers"], int) and data["total_offers"] >= 0
        assert isinstance(data["pending_offers"], int) and data["pending_offers"] >= 0
        
        # pending_offers should be <= total_offers
        assert data["pending_offers"] <= data["total_offers"]


# ==================== NO MONGODB _ID FIELDS ====================
class TestOffersNoMongoDBId:
    """Verify no MongoDB _id fields in offer responses"""
    
    def test_offers_no_underscore_id(self, api_client):
        """Offers should not have _id field"""
        response = api_client.get(f"{BASE_URL}/api/offers")
        offers = response.json()
        for o in offers:
            assert "_id" not in o, f"Offer {o['offer_code']} contains _id field"
    
    def test_single_offer_no_underscore_id(self, api_client):
        """Single offer GET should not have _id field"""
        offers = api_client.get(f"{BASE_URL}/api/offers").json()
        if offers:
            offer_id = offers[0]["id"]
            response = api_client.get(f"{BASE_URL}/api/offers/{offer_id}")
            data = response.json()
            assert "_id" not in data, "Single offer contains _id field"


# ==================== SEEDED OFFERS VERIFICATION ====================
class TestSeededOffers:
    """Verify seeded offers match expected data"""
    
    def test_seeded_offer_ofr_0001_audit(self, api_client):
        """OFR-0001 should be Audit type with correct amounts"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "OFR-0001"})
        offers = response.json()
        
        ofr_0001 = next((o for o in offers if o["offer_code"] == "OFR-0001"), None)
        assert ofr_0001 is not None, "OFR-0001 not found"
        
        assert ofr_0001["offer_type"] == "Audit"
        assert ofr_0001["effective_type"] == "Audit"
        assert ofr_0001["base_amount"] == 28000
        assert ofr_0001["gst_percent"] == 18
        assert ofr_0001["gst_amount"] == 5040  # 28000 * 18%
        assert ofr_0001["total_amount"] == 33040  # 28000 + 5040
        assert "Mrs. Husna Ara Sayed" in ofr_0001["client_name"]
    
    def test_seeded_offer_ofr_0002_steel(self, api_client):
        """OFR-0002 should be Steel type with correct amounts"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "OFR-0002"})
        offers = response.json()
        
        ofr_0002 = next((o for o in offers if o["offer_code"] == "OFR-0002"), None)
        assert ofr_0002 is not None, "OFR-0002 not found"
        
        assert ofr_0002["offer_type"] == "Steel"
        assert ofr_0002["effective_type"] == "Steel"
        assert ofr_0002["base_amount"] == 200000
        assert ofr_0002["gst_amount"] == 36000  # 200000 * 18%
        assert ofr_0002["total_amount"] == 236000
        assert "Rohan Enterprises" in ofr_0002["client_name"]
    
    def test_seeded_offer_ofr_0003_pmc_custom(self, api_client):
        """OFR-0003 should be Other type with PMC as custom_type"""
        response = api_client.get(f"{BASE_URL}/api/offers", params={"search": "OFR-0003"})
        offers = response.json()
        
        ofr_0003 = next((o for o in offers if o["offer_code"] == "OFR-0003"), None)
        assert ofr_0003 is not None, "OFR-0003 not found"
        
        assert ofr_0003["offer_type"] == "Other"
        assert ofr_0003["custom_type"] == "PMC"
        assert ofr_0003["effective_type"] == "PMC"  # Should use custom_type
        assert ofr_0003["base_amount"] == 150000
        assert ofr_0003["gst_amount"] == 27000  # 150000 * 18%
        assert ofr_0003["total_amount"] == 177000
        assert "Sunrise Developers" in ofr_0003["client_name"]
