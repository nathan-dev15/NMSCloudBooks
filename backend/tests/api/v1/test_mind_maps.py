import pytest
from httpx import AsyncClient

BASE = "/api/v1/mind-maps"


class TestMindMapCRUD:
    async def test_list_empty(self, client: AsyncClient):
        resp = await client.get(BASE)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_mind_map(self, client: AsyncClient):
        resp = await client.post(BASE, json={"title": "My Map", "description": "Test"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My Map"
        assert data["description"] == "Test"
        assert len(data["nodes"]) == 1
        assert data["nodes"][0]["title"] == "My Map"

    async def test_create_without_auth(self, client: AsyncClient):
        resp = await client.post(BASE, json={"title": "Public Map"})
        assert resp.status_code == 201

    async def test_create_empty_title_rejected(self, client: AsyncClient):
        resp = await client.post(BASE, json={"title": "   "})
        assert resp.status_code == 422

    async def test_get_mind_map(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Detail Test"})
        mm_id = create.json()["id"]

        resp = await client.get(f"{BASE}/{mm_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == mm_id
        assert "nodes" in data
        assert "edges" in data

    async def test_get_not_found(self, client: AsyncClient):
        resp = await client.get(f"{BASE}/99999")
        assert resp.status_code == 404

    async def test_update_mind_map(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Original"})
        mm_id = create.json()["id"]

        resp = await client.put(f"{BASE}/{mm_id}", json={"title": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated"

    async def test_delete_mind_map(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "To Delete"})
        mm_id = create.json()["id"]

        resp = await client.delete(f"{BASE}/{mm_id}")
        assert resp.status_code == 204

        get_resp = await client.get(f"{BASE}/{mm_id}")
        assert get_resp.status_code == 404

    async def test_list_excludes_deleted(self, client: AsyncClient):
        await client.post(BASE, json={"title": "Keep"})
        del_resp = await client.post(BASE, json={"title": "Remove"})
        await client.delete(f"{BASE}/{del_resp.json()['id']}")

        resp = await client.get(BASE)
        titles = [m["title"] for m in resp.json()]
        assert "Keep" in titles
        assert "Remove" not in titles

    async def test_list_returns_node_count(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Count Test"})
        mm_id = create.json()["id"]
        await client.post(f"{BASE}/{mm_id}/nodes", json={"title": "Extra"})

        resp = await client.get(BASE)
        mm = next(m for m in resp.json() if m["id"] == mm_id)
        assert mm["node_count"] == 2


class TestMindMapNodes:
    async def test_add_node(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Node Test"})
        mm_id = create.json()["id"]

        resp = await client.post(f"{BASE}/{mm_id}/nodes", json={
            "title": "Child",
            "position_x": 100,
            "position_y": 200,
            "color": "#3b82f6",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Child"
        assert data["position_x"] == 100
        assert data["color"] == "#3b82f6"

    async def test_add_node_with_parent_creates_edge(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Edge Auto"})
        mm_id = create.json()["id"]
        root_id = create.json()["nodes"][0]["id"]

        await client.post(f"{BASE}/{mm_id}/nodes", json={
            "title": "Child",
            "parent_node_id": root_id,
        })

        detail = await client.get(f"{BASE}/{mm_id}")
        assert len(detail.json()["edges"]) == 1
        assert detail.json()["edges"][0]["source_node_id"] == root_id

    async def test_add_node_invalid_parent(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Bad Parent"})
        mm_id = create.json()["id"]

        resp = await client.post(f"{BASE}/{mm_id}/nodes", json={
            "title": "Orphan",
            "parent_node_id": 99999,
        })
        assert resp.status_code == 400

    async def test_update_node(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Update Node"})
        mm_id = create.json()["id"]
        node_id = create.json()["nodes"][0]["id"]

        resp = await client.patch(f"{BASE}/{mm_id}/nodes/{node_id}", json={
            "title": "Renamed",
            "color": "#ef4444",
        })
        assert resp.status_code == 200
        assert resp.json()["title"] == "Renamed"
        assert resp.json()["color"] == "#ef4444"

    async def test_update_node_self_parent_rejected(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Self Ref"})
        mm_id = create.json()["id"]
        node_id = create.json()["nodes"][0]["id"]

        resp = await client.patch(f"{BASE}/{mm_id}/nodes/{node_id}", json={
            "parent_node_id": node_id,
        })
        assert resp.status_code == 400

    async def test_delete_node(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Del Node"})
        mm_id = create.json()["id"]
        node_resp = await client.post(f"{BASE}/{mm_id}/nodes", json={"title": "Extra"})
        extra_id = node_resp.json()["id"]

        resp = await client.delete(f"{BASE}/{mm_id}/nodes/{extra_id}")
        assert resp.status_code == 204

        detail = await client.get(f"{BASE}/{mm_id}")
        node_ids = [n["id"] for n in detail.json()["nodes"]]
        assert extra_id not in node_ids

    async def test_delete_node_reparents_children(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Reparent"})
        mm_id = create.json()["id"]
        root_id = create.json()["nodes"][0]["id"]

        mid_resp = await client.post(f"{BASE}/{mm_id}/nodes", json={
            "title": "Middle",
            "parent_node_id": root_id,
        })
        mid_id = mid_resp.json()["id"]

        child_resp = await client.post(f"{BASE}/{mm_id}/nodes", json={
            "title": "Leaf",
            "parent_node_id": mid_id,
        })
        child_id = child_resp.json()["id"]

        await client.delete(f"{BASE}/{mm_id}/nodes/{mid_id}")

        detail = await client.get(f"{BASE}/{mm_id}")
        leaf = next(n for n in detail.json()["nodes"] if n["id"] == child_id)
        assert leaf["parent_node_id"] == root_id


class TestMindMapEdges:
    async def test_add_edge(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Edge Test"})
        mm_id = create.json()["id"]
        root_id = create.json()["nodes"][0]["id"]

        n2 = await client.post(f"{BASE}/{mm_id}/nodes", json={"title": "Node 2"})
        n2_id = n2.json()["id"]

        resp = await client.post(f"{BASE}/{mm_id}/edges", json={
            "source_node_id": root_id,
            "target_node_id": n2_id,
        })
        assert resp.status_code == 201
        assert resp.json()["source_node_id"] == root_id

    async def test_self_referencing_edge_rejected(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Self Edge"})
        mm_id = create.json()["id"]
        root_id = create.json()["nodes"][0]["id"]

        resp = await client.post(f"{BASE}/{mm_id}/edges", json={
            "source_node_id": root_id,
            "target_node_id": root_id,
        })
        assert resp.status_code == 400

    async def test_duplicate_edge_rejected(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Dup Edge"})
        mm_id = create.json()["id"]
        root_id = create.json()["nodes"][0]["id"]

        n2 = await client.post(f"{BASE}/{mm_id}/nodes", json={"title": "Node 2"})
        n2_id = n2.json()["id"]

        await client.post(f"{BASE}/{mm_id}/edges", json={
            "source_node_id": root_id,
            "target_node_id": n2_id,
        })
        resp = await client.post(f"{BASE}/{mm_id}/edges", json={
            "source_node_id": root_id,
            "target_node_id": n2_id,
        })
        assert resp.status_code == 409

    async def test_delete_edge(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Del Edge"})
        mm_id = create.json()["id"]
        root_id = create.json()["nodes"][0]["id"]

        n2 = await client.post(f"{BASE}/{mm_id}/nodes", json={"title": "Node 2"})
        n2_id = n2.json()["id"]

        edge = await client.post(f"{BASE}/{mm_id}/edges", json={
            "source_node_id": root_id,
            "target_node_id": n2_id,
        })
        edge_id = edge.json()["id"]

        resp = await client.delete(f"{BASE}/{mm_id}/edges/{edge_id}")
        assert resp.status_code == 204

    async def test_delete_nonexistent_edge(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "No Edge"})
        mm_id = create.json()["id"]

        resp = await client.delete(f"{BASE}/{mm_id}/edges/99999")
        assert resp.status_code == 404


class TestMindMapLayout:
    async def test_save_layout(self, client: AsyncClient):
        create = await client.post(BASE, json={"title": "Layout Test"})
        mm_id = create.json()["id"]
        node_id = create.json()["nodes"][0]["id"]

        resp = await client.put(f"{BASE}/{mm_id}/layout", json={
            "positions": [{"id": node_id, "position_x": 300, "position_y": 400}],
        })
        assert resp.status_code == 200

        detail = await client.get(f"{BASE}/{mm_id}")
        node = next(n for n in detail.json()["nodes"] if n["id"] == node_id)
        assert node["position_x"] == 300
        assert node["position_y"] == 400
