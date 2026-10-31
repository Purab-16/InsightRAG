from datetime import datetime, timedelta, timezone

from app.db import get_db
from app.models import GraphEdge, GraphNode, GraphResponse
from ingestion.s2_client import fetch_graph_data

CACHE_TTL = timedelta(days=7)
S2_URL = "https://www.semanticscholar.org/paper/"


def _cached(paper: dict) -> dict | None:
    fetched = paper.get("s2_fetched_at")
    if paper.get("s2_data") is None or not fetched:
        return None
    if datetime.now(timezone.utc) - datetime.fromisoformat(fetched) > CACHE_TTL:
        return None
    return paper["s2_data"]


def _load(paper: dict) -> dict:
    data = _cached(paper)
    if data is None:
        data = fetch_graph_data(paper["arxiv_id"], paper["title"])
        get_db().table("papers").update(
            {"s2_data": data, "s2_fetched_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", paper["id"]).execute()
    return data


def _node(s2: dict, kind: str) -> GraphNode:
    return GraphNode(
        id=f"s2:{s2['paperId']}",
        label=s2["title"],
        year=s2.get("year"),
        citation_count=s2.get("citationCount"),
        kind=kind,
        arxiv_id=(s2.get("externalIds") or {}).get("ArXiv"),
        url=f"{S2_URL}{s2['paperId']}",
    )


def build_graph(paper: dict, limit: int) -> GraphResponse:
    """Citation graph. Edges follow influence: reference -> center -> citation."""
    data = _load(paper)
    s2 = data["paper"]

    published = paper.get("published")
    center = GraphNode(
        id="center",
        label=paper["title"],
        year=(s2 or {}).get("year") or (int(published[:4]) if published else None),
        citation_count=(s2 or {}).get("citationCount"),
        kind="center",
        arxiv_id=paper.get("arxiv_id"),
        url=f"{S2_URL}{s2['paperId']}" if s2 else None,
    )
    if s2 is None:
        return GraphResponse(nodes=[center], edges=[])

    nodes, edges, seen = [center], [], {f"s2:{s2['paperId']}"}

    for entry in data["references"][:limit]:
        node = _node(entry, "reference")
        if node.id in seen:
            continue
        seen.add(node.id)
        nodes.append(node)
        edges.append(GraphEdge(source=node.id, target="center"))

    for entry in data["citations"][:limit]:
        node = _node(entry, "citation")
        if node.id in seen:  # also a reference: keep one node, avoid a cycle
            continue
        seen.add(node.id)
        nodes.append(node)
        edges.append(GraphEdge(source="center", target=node.id))

    return GraphResponse(nodes=nodes, edges=edges)
