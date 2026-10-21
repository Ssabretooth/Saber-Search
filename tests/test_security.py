import os
import httpx
import pytest

@pytest.fixture
def anon_client():
    url = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    if not anon_key:
        pytest.skip("SUPABASE_ANON_KEY not set")
    return httpx.Client(base_url=f"{url}/rest/v1", headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"})

@pytest.mark.parametrize("view", ["v_disclosures_public", "v_spending_public", "v_judicial_public"])
def test_anon_can_read_views(anon_client, view):
    res = anon_client.get(f"/{view}?select=*&limit=1")
    assert res.status_code == 200

@pytest.mark.parametrize("table", ["financial_disclosures", "state_spending_logs", "judicial_proceedings"])
def test_anon_cannot_read_base_tables(anon_client, table):
    res = anon_client.get(f"/{table}?select=*&limit=1")
    assert res.status_code in (401, 403)
