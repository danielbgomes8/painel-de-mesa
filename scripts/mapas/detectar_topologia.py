#!/usr/bin/env python3
"""Detect dungeon wall edges, room cores and likely door thresholds (v2).

Usage:
    python dungeon_topology.py map.png -o annotated.png --json topology.json

Dependencies:
    pip install opencv-python numpy scikit-image

Notes:
- This is computer vision/topology, not OCR. OCR is useful only for text labels.
- Best on top-down maps with a dark/black void around the dungeon.
- Door detection is heuristic. Door endpoints are snapped to the actual foreground wall boundaries by ray casting.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from skimage.morphology import skeletonize


@dataclass
class Door:
    x1: float
    y1: float
    x2: float
    y2: float
    cx: float
    cy: float
    room_id: int
    confidence: float


@dataclass
class Room:
    room_id: int
    cx: float
    cy: float
    x: int
    y: int
    w: int
    h: int
    core_area: int


def _largest_component(mask: np.ndarray) -> np.ndarray:
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return mask.astype(np.uint8)
    idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    return (labels == idx).astype(np.uint8)


def segment_dungeon(img: np.ndarray, bg_distance: float = 16.0, fill_hole_area: int = 600) -> np.ndarray:
    """Segment dungeon artwork from a nearly uniform dark void/background."""
    h, w = img.shape[:2]
    s = max(8, min(h, w) // 60)
    corners = np.concatenate([
        img[:s, :s].reshape(-1, 3),
        img[:s, -s:].reshape(-1, 3),
        img[-s:, :s].reshape(-1, 3),
        img[-s:, -s:].reshape(-1, 3),
    ], axis=0).astype(np.float32)
    bg = np.median(corners, axis=0)
    diff = np.linalg.norm(img.astype(np.float32) - bg[None, None, :], axis=2)
    mask = (diff > bg_distance).astype(np.uint8) * 255

    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    fg = _largest_component(mask > 0)

    # Fill only very small enclosed dark holes caused by texture/shadows.
    inv = (1 - fg).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inv, 8)
    H, W = fg.shape
    for i in range(1, n):
        x, y, ww, hh, area = stats[i]
        touches_border = x == 0 or y == 0 or x + ww >= W or y + hh >= H
        if not touches_border and area <= fill_hole_area:
            fg[labels == i] = 1
    return fg


def simplify_wall_contours(fg: np.ndarray, epsilon: float = 1.5, min_perimeter: float = 60.0):
    contours, _ = cv2.findContours(fg, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in contours:
        per = cv2.arcLength(c, True)
        if per < min_perimeter:
            continue
        approx = cv2.approxPolyDP(c, epsilon, True)
        pts = [[int(p[0][0]), int(p[0][1])] for p in approx]
        out.append((c, pts))
    return out


def _auto_room_threshold(dist: np.ndarray, skel: np.ndarray) -> float:
    vals = dist[skel]
    vals = vals[np.isfinite(vals) & (vals > 0)]
    if len(vals) < 32:
        return 30.0
    v8 = np.clip(vals, 0, 255).astype(np.uint8).reshape(-1, 1)
    otsu, _ = cv2.threshold(v8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Slightly below the bimodal split gives better room/corridor transitions.
    return float(max(12.0, otsu * 0.80))


def _cluster_points(points: np.ndarray, radius: float = 12.0) -> list[np.ndarray]:
    if len(points) == 0:
        return []
    points = np.asarray(points, dtype=np.float32)
    unused = set(range(len(points)))
    clusters = []
    r2 = radius * radius
    while unused:
        seed = unused.pop()
        q = [seed]
        comp = [seed]
        while q:
            i = q.pop()
            if not unused:
                continue
            candidates = np.fromiter(unused, dtype=np.int32)
            d = points[candidates] - points[i]
            near = candidates[np.sum(d * d, axis=1) <= r2]
            for j in near.tolist():
                if j in unused:
                    unused.remove(j)
                    q.append(j)
                    comp.append(j)
        clusters.append(points[comp])
    return clusters


def detect_rooms_and_doors(
    fg: np.ndarray,
    room_threshold: float | None = None,
    min_room_core_area: int = 250,
    max_door_width: float = 70.0,
):
    dist = cv2.distanceTransform(fg.astype(np.uint8), cv2.DIST_L2, 5)
    skel = skeletonize(fg > 0)
    if room_threshold is None:
        room_threshold = _auto_room_threshold(dist, skel)

    core = (dist >= room_threshold).astype(np.uint8)
    nc, core_labels, stats, cents = cv2.connectedComponentsWithStats(core, 8)
    valid_rooms = {
        i for i in range(1, nc)
        if stats[i, cv2.CC_STAT_AREA] >= min_room_core_area
    }

    rooms: list[Room] = []
    for rid in sorted(valid_rooms):
        x, y, w, h, area = stats[rid]
        cx, cy = cents[rid]
        rooms.append(Room(rid, float(cx), float(cy), int(x), int(y), int(w), int(h), int(area)))

    # Skeleton pixels narrower than the room-core threshold form corridor networks.
    corridor_skel = skel & (dist < room_threshold)
    nl, low_labels, _, _ = cv2.connectedComponentsWithStats(corridor_skel.astype(np.uint8), 8)
    H, W = fg.shape

    candidates = []
    for li in range(1, nl):
        ys, xs = np.nonzero(low_labels == li)
        if len(xs) < 8:
            continue

        adj: dict[int, list[tuple[int, int]]] = {}
        for y, x in zip(ys, xs):
            sub = core_labels[max(0, y - 1):min(H, y + 2), max(0, x - 1):min(W, x + 2)]
            for rid in np.unique(sub):
                rid = int(rid)
                if rid in valid_rooms:
                    adj.setdefault(rid, []).append((x, y))

        # A corridor component touching fewer than two room cores is usually a medial-axis spur.
        if len(adj) < 2:
            continue

        component_xy = np.column_stack([xs, ys]).astype(np.float32)
        for rid, pts in adj.items():
            pts = np.unique(np.asarray(pts, dtype=np.float32), axis=0)
            for cluster in _cluster_points(pts, 12.0):
                c = cluster.mean(axis=0)
                candidates.append((li, rid, c, component_xy))

    doors: list[Door] = []
    for li, rid, center, comp_xy in candidates:
        cx, cy = float(center[0]), float(center[1])

        # Estimate corridor tangent using nearby skeleton pixels.
        d2 = (comp_xy[:, 0] - cx) ** 2 + (comp_xy[:, 1] - cy) ** 2
        local = comp_xy[d2 <= 24.0 ** 2]
        if len(local) < 6:
            continue
        X = local - local.mean(axis=0)
        cov = np.cov(X.T)
        eigval, eigvec = np.linalg.eigh(cov)
        tangent = eigvec[:, int(np.argmax(eigval))]
        straightness = float(eigval.max() / (eigval.min() + 1e-6))

        # Most battle maps are axis-aligned; snap when close to a cardinal direction.
        ang = math.atan2(float(tangent[1]), float(tangent[0])) % math.pi
        delta_h = min(abs(ang), abs(math.pi - ang))
        delta_v = abs(ang - math.pi / 2)
        if min(delta_h, delta_v) < math.radians(22):
            tangent = np.array([1.0, 0.0]) if delta_h < delta_v else np.array([0.0, 1.0])
        normal = np.array([-tangent[1], tangent[0]], dtype=np.float32)

        # IMPORTANT: a door must terminate on the two actual wall edges.
        # The old implementation guessed the endpoints from distanceTransform(),
        # which estimates a radius and therefore systematically stopped short of
        # (or overshot) the visible wall contour.  Here we ray-cast from the
        # corridor center along the normal in both directions until we cross the
        # foreground/background boundary.  We also slide a little along the
        # corridor tangent and select the nearest narrow cross-section, which
        # places the threshold at the room/corridor neck rather than inside a room.
        def inside_xy(pt):
            x, y = float(pt[0]), float(pt[1])
            xi, yi = int(round(x)), int(round(y))
            return 0 <= xi < W and 0 <= yi < H and bool(fg[yi, xi])

        def ray_hit_edge(origin, direction, max_ray=180.0, step=0.35):
            # origin is expected to be inside the dungeon mask. Return the
            # sub-pixel point where the ray leaves the foreground.
            if not inside_xy(origin):
                return None
            prev = np.asarray(origin, dtype=np.float32)
            d = np.asarray(direction, dtype=np.float32)
            nrm = float(np.linalg.norm(d))
            if nrm < 1e-6:
                return None
            d /= nrm
            s = step
            while s <= max_ray:
                cur = np.asarray(origin, dtype=np.float32) + d * s
                if not inside_xy(cur):
                    # Binary search the last inside / first outside interval to
                    # get a stable sub-pixel boundary intersection.
                    lo = prev.copy()
                    hi = cur.copy()
                    for _ in range(9):
                        mid = (lo + hi) * 0.5
                        if inside_xy(mid):
                            lo = mid
                        else:
                            hi = mid
                    return (lo + hi) * 0.5
                prev = cur
                s += step
            return None

        def cross_section(origin):
            a = ray_hit_edge(origin, -normal)
            b = ray_hit_edge(origin,  normal)
            if a is None or b is None:
                return None
            return a, b, float(np.linalg.norm(b - a))

        # Search around the candidate along the corridor axis. A small penalty
        # for displacement prevents the optimizer from jumping to an unrelated
        # narrow spot farther down the passage.
        best = None
        base = np.array([cx, cy], dtype=np.float32)
        search_radius = min(52, max(18, int(room_threshold * 1.15)))
        for off in range(-search_radius, search_radius + 1):
            q = base + tangent * float(off)
            sec = cross_section(q)
            if sec is None:
                continue
            a, b, section_w = sec
            # Reject implausibly tiny cuts and cuts that clearly span a room.
            if section_w < 10.0 or section_w > max_door_width:
                continue
            score = section_w + 0.10 * abs(off)
            if best is None or score < best[0]:
                best = (score, q, a, b, section_w)

        if best is None:
            continue

        _, q, p1, p2, width = best
        cx, cy = float(q[0]), float(q[1])

        # Heuristic confidence: straight corridor + doorway narrower than room-core split.
        narrowness = max(0.0, min(1.0, 1.0 - width / max(max_door_width, 1.0)))
        line_score = max(0.0, min(1.0, (straightness - 1.0) / 12.0))
        confidence = 0.55 * narrowness + 0.45 * line_score
        doors.append(Door(float(p1[0]), float(p1[1]), float(p2[0]), float(p2[1]), cx, cy, rid, confidence))

    # De-duplicate nearby door candidates, keeping the highest-confidence one.
    doors.sort(key=lambda d: d.confidence, reverse=True)
    kept: list[Door] = []
    for d in doors:
        if all((d.cx - k.cx) ** 2 + (d.cy - k.cy) ** 2 > 18.0 ** 2 for k in kept):
            kept.append(d)

    return rooms, kept, float(room_threshold), dist, skel


def draw_result(img: np.ndarray, fg: np.ndarray, walls, doors: Iterable[Door]) -> np.ndarray:
    out = img.copy()
    for contour, _ in walls:
        cv2.drawContours(out, [contour], -1, (0, 0, 255), 3, lineType=cv2.LINE_AA)
    for d in doors:
        p1 = (int(round(d.x1)), int(round(d.y1)))
        p2 = (int(round(d.x2)), int(round(d.y2)))
        cv2.line(out, p1, p2, (0, 255, 255), 5, cv2.LINE_AA)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("annotated.png"))
    ap.add_argument("--json", dest="json_path", type=Path, default=Path("topology.json"))
    ap.add_argument("--bg-distance", type=float, default=16.0)
    ap.add_argument("--room-threshold", type=str, default="auto", help="auto or pixels, e.g. 42")
    ap.add_argument("--min-room-core-area", type=int, default=250)
    ap.add_argument("--max-door-width", type=float, default=70.0)
    args = ap.parse_args()

    img = cv2.imread(str(args.input), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Could not read {args.input}")

    fg = segment_dungeon(img, bg_distance=args.bg_distance)
    walls = simplify_wall_contours(fg)
    room_thr = None if args.room_threshold.lower() == "auto" else float(args.room_threshold)
    rooms, doors, used_thr, _, _ = detect_rooms_and_doors(
        fg,
        room_threshold=room_thr,
        min_room_core_area=args.min_room_core_area,
        max_door_width=args.max_door_width,
    )
    annotated = draw_result(img, fg, walls, doors)
    cv2.imwrite(str(args.output), annotated)

    data = {
        "image": {"width": int(img.shape[1]), "height": int(img.shape[0])},
        "parameters": {
            "bg_distance": args.bg_distance,
            "room_threshold": used_thr,
            "min_room_core_area": args.min_room_core_area,
            "max_door_width": args.max_door_width,
        },
        "walls": [pts for _, pts in walls],
        "rooms": [asdict(r) for r in rooms],
        "doors": [asdict(d) for d in doors],
    }
    args.json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved: {args.output}")
    print(f"Saved: {args.json_path}")
    print(f"Wall contours: {len(walls)} | rooms: {len(rooms)} | doors: {len(doors)} | room threshold: {used_thr:.1f}px")


if __name__ == "__main__":
    main()
