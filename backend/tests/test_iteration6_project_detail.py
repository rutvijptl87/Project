"""
Iteration 6 Tests: Project Detail Page Features
- Activity log endpoints (GET /api/projects/{id}/activity)
- Quote revisions (GET/POST /api/projects/{id}/revisions, /revise-quote)
- Delete payment (DELETE /api/payments/{id})
- Per-project Excel export (GET /api/projects/{id}/export)
- Activity logging on create, update, payment add/delete, revise, archive, unarchive
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestActivityEndpoint:
    """Test GET /api/projects/{id}/activity endpoint"""
    
    def test_activity_endpoint_returns_list(self):
        """Activity endpoint returns a list"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        assert len(projects) > 0, "Need at least one project"
        project_id = projects[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_activity_sorted_desc_by_created_at(self):
        """Activity entries are sorted descending by created_at"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity")
        data = response.json()
        
        if len(data) >= 2:
            # Check descending order
            for i in range(len(data) - 1):
                assert data[i]['created_at'] >= data[i+1]['created_at'], \
                    f"Activity not sorted desc: {data[i]['created_at']} < {data[i+1]['created_at']}"
    
    def test_activity_has_required_fields(self):
        """Activity entries have required fields"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity")
        data = response.json()
        
        if len(data) > 0:
            entry = data[0]
            assert 'id' in entry
            assert 'project_id' in entry
            assert 'action' in entry
            assert 'detail' in entry
            assert 'created_at' in entry
    
    def test_activity_no_mongodb_id(self):
        """Activity entries don't have MongoDB _id"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity")
        data = response.json()
        
        for entry in data:
            assert '_id' not in entry, "MongoDB _id should not be in response"


class TestQuoteRevisions:
    """Test quote revision endpoints"""
    
    def test_revisions_endpoint_returns_list(self):
        """GET /api/projects/{id}/revisions returns a list"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/revisions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_revise_quote_creates_revision(self):
        """POST /api/projects/{id}/revise-quote creates a revision"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        # Find a project to test with
        project = projects[0]
        project_id = project['id']
        old_quoted = project['quoted_amount']
        new_amount = old_quoted + 10000
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/revise-quote",
            json={"new_amount": new_amount, "reason": "TEST_revision_pytest"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data['old_amount'] == old_quoted
        assert data['new_amount'] == new_amount
        assert data['reason'] == "TEST_revision_pytest"
        assert 'id' in data
        assert 'created_at' in data
    
    def test_revise_quote_updates_project_quoted_amount(self):
        """Revising quote updates project.quoted_amount"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project = projects[0]
        project_id = project['id']
        new_amount = 999999.99
        
        requests.post(
            f"{BASE_URL}/api/projects/{project_id}/revise-quote",
            json={"new_amount": new_amount, "reason": "TEST_update_check"}
        )
        
        # Verify project was updated
        updated = requests.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert updated['quoted_amount'] == new_amount
    
    def test_revise_quote_negative_amount_returns_400(self):
        """POST /api/projects/{id}/revise-quote with negative amount returns 400"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{project_id}/revise-quote",
            json={"new_amount": -5000, "reason": "Negative test"}
        )
        assert response.status_code == 400
        assert "Amount must be >= 0" in response.json().get('detail', '')
    
    def test_revise_quote_logs_activity(self):
        """Revising quote logs QUOTE REVISED activity"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project = projects[0]
        project_id = project['id']
        
        requests.post(
            f"{BASE_URL}/api/projects/{project_id}/revise-quote",
            json={"new_amount": 888888, "reason": "TEST_activity_log_check"}
        )
        
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        assert len(activity) > 0
        latest = activity[0]
        assert latest['action'] == 'QUOTE REVISED'
        assert 'TEST_activity_log_check' in latest['detail']
    
    def test_revisions_sorted_desc(self):
        """Revisions are sorted descending by created_at"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        # Create multiple revisions
        for i in range(2):
            requests.post(
                f"{BASE_URL}/api/projects/{project_id}/revise-quote",
                json={"new_amount": 100000 + i * 1000, "reason": f"TEST_sort_{i}"}
            )
        
        revisions = requests.get(f"{BASE_URL}/api/projects/{project_id}/revisions").json()
        if len(revisions) >= 2:
            for i in range(len(revisions) - 1):
                assert revisions[i]['created_at'] >= revisions[i+1]['created_at']


class TestDeletePayment:
    """Test DELETE /api/payments/{id} endpoint"""
    
    def test_delete_payment_returns_ok(self):
        """DELETE /api/payments/{id} returns ok"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        # Create a payment first
        pay_resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={"project_id": project_id, "amount": 1000, "notes": "TEST_delete_payment"}
        )
        payment_id = pay_resp.json()['id']
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/payments/{payment_id}")
        assert response.status_code == 200
        assert response.json().get('ok') == True
    
    def test_delete_payment_updates_project_received(self):
        """Deleting payment subtracts from project.received_amount"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project = projects[0]
        project_id = project['id']
        
        # Get current received
        before = requests.get(f"{BASE_URL}/api/projects/{project_id}").json()
        before_received = before['received_amount']
        
        # Create a payment
        pay_resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={"project_id": project_id, "amount": 5000, "notes": "TEST_delete_check"}
        )
        payment_id = pay_resp.json()['id']
        
        # Verify received increased
        after_add = requests.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert after_add['received_amount'] == before_received + 5000
        
        # Delete payment
        requests.delete(f"{BASE_URL}/api/payments/{payment_id}")
        
        # Verify received decreased back
        after_delete = requests.get(f"{BASE_URL}/api/projects/{project_id}").json()
        assert after_delete['received_amount'] == before_received
    
    def test_delete_payment_logs_activity(self):
        """Deleting payment logs PAYMENT DELETED activity"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        # Create and delete a payment
        pay_resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={"project_id": project_id, "amount": 2500, "notes": "TEST_delete_activity"}
        )
        payment_id = pay_resp.json()['id']
        requests.delete(f"{BASE_URL}/api/payments/{payment_id}")
        
        # Check activity
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        assert len(activity) > 0
        latest = activity[0]
        assert latest['action'] == 'PAYMENT DELETED'
        assert '2,500' in latest['detail'] or '2500' in latest['detail']
    
    def test_delete_nonexistent_payment_returns_404(self):
        """DELETE /api/payments/{id} with invalid ID returns 404"""
        response = requests.delete(f"{BASE_URL}/api/payments/nonexistent-id-12345")
        assert response.status_code == 404


class TestProjectExcelExport:
    """Test GET /api/projects/{id}/export endpoint"""
    
    def test_export_returns_xlsx(self):
        """Export endpoint returns xlsx file"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/export")
        assert response.status_code == 200
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers.get('Content-Type', '')
    
    def test_export_has_content_disposition(self):
        """Export has Content-Disposition header with filename"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project = projects[0]
        project_id = project['id']
        
        response = requests.get(f"{BASE_URL}/api/projects/{project_id}/export")
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disp
        assert project['project_code'] in content_disp
    
    def test_export_nonexistent_project_returns_404(self):
        """Export for nonexistent project returns 404"""
        response = requests.get(f"{BASE_URL}/api/projects/nonexistent-id-12345/export")
        assert response.status_code == 404


class TestActivityLogging:
    """Test that various actions log activity"""
    
    def test_create_project_logs_activity(self):
        """Creating a project logs PROJECT CREATED activity"""
        # Create a new project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": "TEST_Activity_Log_Project",
                "quoted_amount": 50000,
                "site_location": "Test Location"
            }
        )
        assert response.status_code == 200
        project = response.json()
        project_id = project['id']
        
        # Check activity
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        assert len(activity) >= 1
        # Find PROJECT CREATED
        created_actions = [a for a in activity if a['action'] == 'PROJECT CREATED']
        assert len(created_actions) >= 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_update_project_logs_activity(self):
        """Updating a project logs PROJECT UPDATED activity"""
        # Create a project
        create_resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_Update_Log", "quoted_amount": 10000}
        )
        project = create_resp.json()
        project_id = project['id']
        
        # Update it
        requests.put(
            f"{BASE_URL}/api/projects/{project_id}",
            json={"name": "TEST_Update_Log_Modified", "quoted_amount": 15000}
        )
        
        # Check activity
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        updated_actions = [a for a in activity if a['action'] == 'PROJECT UPDATED']
        assert len(updated_actions) >= 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_add_payment_logs_activity(self):
        """Adding a payment logs PAYMENT ADDED activity"""
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        project_id = projects[0]['id']
        
        # Add payment
        pay_resp = requests.post(
            f"{BASE_URL}/api/payments",
            json={"project_id": project_id, "amount": 7500, "notes": "TEST_payment_log"}
        )
        payment_id = pay_resp.json()['id']
        
        # Check activity
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        payment_actions = [a for a in activity if a['action'] == 'PAYMENT ADDED' and 'TEST_payment_log' in a.get('detail', '')]
        assert len(payment_actions) >= 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/payments/{payment_id}")
    
    def test_archive_project_logs_activity(self):
        """Archiving a project logs PROJECT ARCHIVED activity"""
        # Create a project
        create_resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_Archive_Log", "quoted_amount": 5000}
        )
        project = create_resp.json()
        project_id = project['id']
        
        # Archive it
        requests.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        
        # Check activity
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        archive_actions = [a for a in activity if a['action'] == 'PROJECT ARCHIVED']
        assert len(archive_actions) >= 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
    
    def test_unarchive_project_logs_activity(self):
        """Unarchiving a project logs PROJECT RESTORED activity"""
        # Create and archive a project
        create_resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_Unarchive_Log", "quoted_amount": 5000}
        )
        project = create_resp.json()
        project_id = project['id']
        requests.post(f"{BASE_URL}/api/projects/{project_id}/archive")
        
        # Unarchive it
        requests.post(f"{BASE_URL}/api/projects/{project_id}/unarchive")
        
        # Check activity
        activity = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        restore_actions = [a for a in activity if a['action'] == 'PROJECT RESTORED']
        assert len(restore_actions) >= 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")


class TestDeleteProjectCascade:
    """Test DELETE /api/projects/{id} cascades to related data"""
    
    def test_delete_project_cascades_payments(self):
        """Deleting project also deletes its payments"""
        # Create a project
        create_resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_Cascade_Delete", "quoted_amount": 100000}
        )
        project = create_resp.json()
        project_id = project['id']
        
        # Add a payment
        requests.post(
            f"{BASE_URL}/api/payments",
            json={"project_id": project_id, "amount": 10000, "notes": "TEST_cascade"}
        )
        
        # Verify payment exists
        payments_before = requests.get(f"{BASE_URL}/api/payments", params={"project_id": project_id}).json()
        assert len(payments_before) >= 1
        
        # Delete project
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
        # Verify payments are gone
        payments_after = requests.get(f"{BASE_URL}/api/payments", params={"project_id": project_id}).json()
        assert len(payments_after) == 0
    
    def test_delete_project_cascades_revisions(self):
        """Deleting project also deletes its quote revisions"""
        # Create a project
        create_resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_Cascade_Revisions", "quoted_amount": 50000}
        )
        project = create_resp.json()
        project_id = project['id']
        
        # Add a revision
        requests.post(
            f"{BASE_URL}/api/projects/{project_id}/revise-quote",
            json={"new_amount": 60000, "reason": "TEST_cascade_rev"}
        )
        
        # Verify revision exists
        revisions_before = requests.get(f"{BASE_URL}/api/projects/{project_id}/revisions").json()
        assert len(revisions_before) >= 1
        
        # Delete project
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
        # Project should be gone (404)
        get_resp = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_resp.status_code == 404
    
    def test_delete_project_cascades_activity(self):
        """Deleting project also deletes its activity log"""
        # Create a project
        create_resp = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_Cascade_Activity", "quoted_amount": 25000}
        )
        project = create_resp.json()
        project_id = project['id']
        
        # Verify activity exists (PROJECT CREATED)
        activity_before = requests.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        assert len(activity_before) >= 1
        
        # Delete project
        requests.delete(f"{BASE_URL}/api/projects/{project_id}")
        
        # Project should be gone
        get_resp = requests.get(f"{BASE_URL}/api/projects/{project_id}")
        assert get_resp.status_code == 404


class TestExistingEndpointsStillWork:
    """Verify existing endpoints from iterations 1-5 still work"""
    
    def test_clients_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/clients")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_architects_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/architects")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_projects_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_offers_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/offers")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_payments_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/payments")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_dashboard_stats_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert 'total_projects' in data
        assert 'total_quoted' in data
        assert 'total_received' in data
    
    def test_auth_status_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/auth/status")
        assert response.status_code == 200
        assert 'password_set' in response.json()


class TestNoMongoDBIdInResponses:
    """Verify no MongoDB _id in any responses"""
    
    def test_projects_no_id(self):
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        for p in projects[:5]:
            assert '_id' not in p
    
    def test_revisions_no_id(self):
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        if projects:
            revisions = requests.get(f"{BASE_URL}/api/projects/{projects[0]['id']}/revisions").json()
            for r in revisions:
                assert '_id' not in r
    
    def test_activity_no_id(self):
        projects = requests.get(f"{BASE_URL}/api/projects").json()
        if projects:
            activity = requests.get(f"{BASE_URL}/api/projects/{projects[0]['id']}/activity").json()
            for a in activity:
                assert '_id' not in a
