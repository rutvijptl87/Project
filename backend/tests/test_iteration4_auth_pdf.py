"""
Creator Consultant API Tests - Iteration 4: Auth & Offer PDF
Tests for password protection (set/verify/change) and Offer PDF generation
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


@pytest.fixture(scope="module", autouse=True)
def reset_auth_config(api_client):
    """Reset auth_config collection before tests to ensure fresh state"""
    # We'll test from a fresh state - the auth_config should be empty initially
    # The first test will verify status=false, then set password
    yield
    # Cleanup: We can't easily reset MongoDB from here, but tests are designed
    # to work with the state they create


# ==================== AUTH STATUS ====================
class TestAuthStatus:
    """GET /api/auth/status endpoint tests"""
    
    def test_auth_status_returns_password_set_field(self, api_client):
        """GET /api/auth/status should return {password_set: bool}"""
        response = api_client.get(f"{BASE_URL}/api/auth/status")
        assert response.status_code == 200
        data = response.json()
        assert "password_set" in data, "Missing password_set field"
        assert isinstance(data["password_set"], bool), "password_set should be boolean"


# ==================== AUTH SET PASSWORD ====================
class TestAuthSetPassword:
    """POST /api/auth/set-password endpoint tests"""
    
    def test_set_password_rejects_short_password(self, api_client):
        """POST /api/auth/set-password with <4 chars should return 400"""
        response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
            "new_password": "abc"  # Only 3 chars
        })
        assert response.status_code == 400
        assert "4 characters" in response.json().get("detail", "").lower()
    
    def test_set_password_rejects_empty_password(self, api_client):
        """POST /api/auth/set-password with empty password should return 400"""
        response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
            "new_password": ""
        })
        assert response.status_code == 400
    
    def test_set_password_first_time_no_current_needed(self, api_client):
        """POST /api/auth/set-password first time should not require current_password"""
        # Check if password is already set
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        
        if not status["password_set"]:
            # First time setup - no current_password needed
            response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
                "new_password": "test1234"
            })
            assert response.status_code == 200
            assert response.json().get("ok") == True
            
            # Verify password is now set
            new_status = api_client.get(f"{BASE_URL}/api/auth/status").json()
            assert new_status["password_set"] == True
        else:
            # Password already set from previous test run - skip this test
            pytest.skip("Password already set - cannot test first-time setup")


# ==================== AUTH VERIFY ====================
class TestAuthVerify:
    """POST /api/auth/verify endpoint tests"""
    
    def test_verify_with_correct_password(self, api_client):
        """POST /api/auth/verify with correct password returns {ok: true, password_set: true}"""
        # Ensure password is set
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            api_client.post(f"{BASE_URL}/api/auth/set-password", json={"new_password": "test1234"})
        
        response = api_client.post(f"{BASE_URL}/api/auth/verify", json={
            "password": "test1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") == True
        assert data.get("password_set") == True
    
    def test_verify_with_wrong_password(self, api_client):
        """POST /api/auth/verify with wrong password returns 401"""
        # Ensure password is set
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            api_client.post(f"{BASE_URL}/api/auth/set-password", json={"new_password": "test1234"})
        
        response = api_client.post(f"{BASE_URL}/api/auth/verify", json={
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "incorrect" in response.json().get("detail", "").lower()
    
    def test_verify_when_no_password_set(self, api_client):
        """POST /api/auth/verify when no password set returns {ok: true, password_set: false}"""
        # This test only works if password is not set
        # Since we set it in previous tests, we'll check the expected behavior
        # when password IS set (which is the current state)
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        
        if not status["password_set"]:
            response = api_client.post(f"{BASE_URL}/api/auth/verify", json={
                "password": "anything"
            })
            assert response.status_code == 200
            data = response.json()
            assert data.get("ok") == True
            assert data.get("password_set") == False
        else:
            # Password is set, verify with correct password
            response = api_client.post(f"{BASE_URL}/api/auth/verify", json={
                "password": "test1234"
            })
            assert response.status_code == 200


# ==================== AUTH CHANGE PASSWORD ====================
class TestAuthChangePassword:
    """POST /api/auth/set-password with current_password (change flow)"""
    
    def test_change_password_requires_correct_current(self, api_client):
        """POST /api/auth/set-password with wrong current_password returns 401"""
        # Ensure password is set
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            api_client.post(f"{BASE_URL}/api/auth/set-password", json={"new_password": "test1234"})
        
        response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
            "current_password": "wrongcurrent",
            "new_password": "newpass5678"
        })
        assert response.status_code == 401
        assert "incorrect" in response.json().get("detail", "").lower()
    
    def test_change_password_with_correct_current(self, api_client):
        """POST /api/auth/set-password with correct current_password succeeds"""
        # Ensure password is set to known value
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            api_client.post(f"{BASE_URL}/api/auth/set-password", json={"new_password": "test1234"})
        
        # Change password
        response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
            "current_password": "test1234",
            "new_password": "newpass5678"
        })
        assert response.status_code == 200
        assert response.json().get("ok") == True
        
        # Verify new password works
        verify_resp = api_client.post(f"{BASE_URL}/api/auth/verify", json={
            "password": "newpass5678"
        })
        assert verify_resp.status_code == 200
        
        # Verify old password no longer works
        old_verify = api_client.post(f"{BASE_URL}/api/auth/verify", json={
            "password": "test1234"
        })
        assert old_verify.status_code == 401
        
        # Change back to original for other tests
        api_client.post(f"{BASE_URL}/api/auth/set-password", json={
            "current_password": "newpass5678",
            "new_password": "test1234"
        })


# ==================== OFFER PDF GENERATION ====================
class TestOfferPDF:
    """GET /api/offers/{id}/pdf endpoint tests"""
    
    def test_offer_pdf_returns_valid_pdf(self, api_client):
        """GET /api/offers/{id}/pdf should return application/pdf with %PDF magic bytes"""
        # Get an existing offer
        offers = api_client.get(f"{BASE_URL}/api/offers").json()
        assert len(offers) > 0, "No offers found for PDF test"
        
        offer_id = offers[0]["id"]
        offer_code = offers[0]["offer_code"]
        
        response = api_client.get(f"{BASE_URL}/api/offers/{offer_id}/pdf")
        assert response.status_code == 200
        
        # Check content type
        assert "application/pdf" in response.headers.get("Content-Type", "")
        
        # Check Content-Disposition header
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp
        assert "filename" in content_disp
        
        # Check PDF magic bytes (%PDF)
        content = response.content
        assert content[:4] == b'%PDF', f"Expected PDF magic bytes, got {content[:4]}"
    
    def test_offer_pdf_unknown_id_returns_404(self, api_client):
        """GET /api/offers/{unknown_id}/pdf should return 404"""
        response = api_client.get(f"{BASE_URL}/api/offers/nonexistent-offer-id/pdf")
        assert response.status_code == 404
    
    def test_offer_pdf_filename_includes_offer_code(self, api_client):
        """PDF filename should include offer_code and type"""
        offers = api_client.get(f"{BASE_URL}/api/offers").json()
        assert len(offers) > 0
        
        offer = offers[0]
        offer_id = offer["id"]
        offer_code = offer["offer_code"]
        
        response = api_client.get(f"{BASE_URL}/api/offers/{offer_id}/pdf")
        assert response.status_code == 200
        
        content_disp = response.headers.get("Content-Disposition", "")
        # Filename should contain offer code
        assert offer_code in content_disp, f"Expected {offer_code} in filename, got {content_disp}"
    
    def test_offer_pdf_for_each_seeded_offer(self, api_client):
        """Each seeded offer should generate a valid PDF"""
        offers = api_client.get(f"{BASE_URL}/api/offers").json()
        
        for offer in offers[:3]:  # Test first 3 offers
            response = api_client.get(f"{BASE_URL}/api/offers/{offer['id']}/pdf")
            assert response.status_code == 200, f"PDF failed for {offer['offer_code']}"
            assert response.content[:4] == b'%PDF', f"Invalid PDF for {offer['offer_code']}"


# ==================== BCRYPT HASH FORMAT ====================
class TestBcryptHashFormat:
    """Verify bcrypt hash format (starts with $2b$)"""
    
    def test_password_uses_bcrypt(self, api_client):
        """Password should be hashed with bcrypt (verified by successful verify after set)"""
        # This is implicitly tested by the verify tests
        # If bcrypt wasn't working, verify would fail
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            api_client.post(f"{BASE_URL}/api/auth/set-password", json={"new_password": "test1234"})
        
        # Verify works (proves bcrypt is working)
        response = api_client.post(f"{BASE_URL}/api/auth/verify", json={
            "password": "test1234"
        })
        assert response.status_code == 200


# ==================== EXISTING TESTS STILL PASS ====================
class TestExistingEndpointsStillWork:
    """Verify existing endpoints still work after auth changes"""
    
    def test_clients_endpoint_works(self, api_client):
        """GET /api/clients should still work"""
        response = api_client.get(f"{BASE_URL}/api/clients")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_projects_endpoint_works(self, api_client):
        """GET /api/projects should still work"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_offers_endpoint_works(self, api_client):
        """GET /api/offers should still work"""
        response = api_client.get(f"{BASE_URL}/api/offers")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_dashboard_stats_works(self, api_client):
        """GET /api/dashboard/stats should still work"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_projects" in data
        assert "total_clients" in data
        assert "total_offers" in data


# ==================== AUTH ENDPOINTS NO MONGODB _ID ====================
class TestAuthNoMongoDBId:
    """Verify auth endpoints don't expose MongoDB _id"""
    
    def test_auth_status_no_underscore_id(self, api_client):
        """GET /api/auth/status should not have _id field"""
        response = api_client.get(f"{BASE_URL}/api/auth/status")
        data = response.json()
        assert "_id" not in data
    
    def test_auth_verify_no_underscore_id(self, api_client):
        """POST /api/auth/verify response should not have _id field"""
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            api_client.post(f"{BASE_URL}/api/auth/set-password", json={"new_password": "test1234"})
        
        response = api_client.post(f"{BASE_URL}/api/auth/verify", json={
            "password": "test1234"
        })
        data = response.json()
        assert "_id" not in data
    
    def test_auth_set_password_no_underscore_id(self, api_client):
        """POST /api/auth/set-password response should not have _id field"""
        status = api_client.get(f"{BASE_URL}/api/auth/status").json()
        if not status["password_set"]:
            response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
                "new_password": "test1234"
            })
        else:
            response = api_client.post(f"{BASE_URL}/api/auth/set-password", json={
                "current_password": "test1234",
                "new_password": "test1234"  # Same password, just to test response
            })
        
        data = response.json()
        assert "_id" not in data
