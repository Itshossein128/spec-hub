#!/usr/bin/env python3
"""Export BookStack structural graph.json to interactive graphify HTML.

Uses graphify.cluster + graphify.export.to_html so the wiki KG gets the same
vis.js viewer as a normal graphify run, without requiring an LLM API key
(typed edges already come from our enricher).
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Usage: export_graphify_html.py <graph.json> <graph.html>",
            file=sys.stderr,
        )
        return 2

    graph_path = Path(sys.argv[1])
    html_path = Path(sys.argv[2])

    try:
        import networkx as nx
        from graphify.cluster import cluster
        from graphify.export import to_html
    except ImportError as err:
        print(
            "graphify is required for HTML viz. Install with: "
            "pip install graphifyy  (or: uv tool install graphifyy)\n"
            f"Import error: {err}",
            file=sys.stderr,
        )
        return 1

    raw = json.loads(graph_path.read_text(encoding="utf-8"))
    # Undirected viz graph — physics layout reads clearer for wiki KGs
    G = nx.Graph()
    for node in raw.get("nodes", []):
        node_id = str(node["id"])
        attrs = {
            "label": str(node.get("label") or node_id),
            "type": str(node.get("type") or "Spec"),
            "file_type": "document",
            "source_file": node.get("source_file") or node.get("relativePath") or "",
        }
        if node.get("unresolved"):
            attrs["unresolved"] = True
        G.add_node(node_id, **attrs)

    for edge in raw.get("edges", []):
        source = str(edge["source"])
        target = str(edge["target"])
        relation = str(edge.get("relation") or edge.get("type") or "RELATED")
        if source in G and target in G:
            # _src/_tgt must be real node ids (graphify HTML uses them as from/to).
            # confidence must be a tier string like "EXTRACTED", not a float.
            G.add_edge(
                source,
                target,
                relation=relation,
                confidence="EXTRACTED",
                _src=source,
                _tgt=target,
            )

    if G.number_of_nodes() == 0:
        print("ERROR: empty graph — nothing to visualize", file=sys.stderr)
        return 1

    communities = cluster(G)
    labels: dict[int, str] = {}
    for cid, members in communities.items():
        type_counts = Counter(
            str(G.nodes[m].get("type") or "Community") for m in members
        )
        majority = type_counts.most_common(1)[0][0]
        labels[cid] = f"{majority} ({len(members)})"

    html_path.parent.mkdir(parents=True, exist_ok=True)
    to_html(G, communities, str(html_path), community_labels=labels)
    print(
        f"Wrote {html_path} "
        f"({G.number_of_nodes()} nodes, {G.number_of_edges()} edges, "
        f"{len(communities)} communities)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
