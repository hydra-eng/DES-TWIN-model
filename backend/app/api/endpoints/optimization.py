import collections
import math
import random
from typing import List, Tuple

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class Point(BaseModel):
    x: float
    y: float


class OptimizationRequest(BaseModel):
    demand_points: List[Point]
    num_stations: int


class OptimizationResponse(BaseModel):
    optimal_locations: List[Point]
    average_distance: float


def distance(p1: Point, p2: Point) -> float:
    return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_station_placement(request: OptimizationRequest):
    """
    Calculates optimal station locations using K-Means clustering.
    """
    points = request.demand_points
    k = request.num_stations

    if not points or k <= 0:
        return OptimizationResponse(optimal_locations=[], average_distance=0.0)

    # Initialize centroids randomly from points
    # (Simple logic: if points < k, just return points)
    if len(points) <= k:
        return OptimizationResponse(optimal_locations=points, average_distance=0.0)

    centroids = random.sample(points, k)

    # Run K-Means
    max_iterations = 50
    final_centroids = centroids

    for _ in range(max_iterations):
        clusters = collections.defaultdict(list)

        # Assign
        for p in points:
            best_idx = 0
            best_dist = float("inf")
            for i, c in enumerate(final_centroids):
                d = distance(p, c)
                if d < best_dist:
                    best_dist = d
                    best_idx = i
            clusters[best_idx].append(p)

        # Update
        new_centroids = []
        max_shift = 0.0

        for i in range(k):
            cluster_points = clusters[i]
            if not cluster_points:
                new_centroids.append(final_centroids[i])
                continue

            avg_x = sum(p.x for p in cluster_points) / len(cluster_points)
            avg_y = sum(p.y for p in cluster_points) / len(cluster_points)
            new_c = Point(x=avg_x, y=avg_y)

            shift = distance(final_centroids[i], new_c)
            if shift > max_shift:
                max_shift = shift

            new_centroids.append(new_c)

        final_centroids = new_centroids
        if max_shift < 0.001:
            break

    # Calculate Avg Distance
    total_dist = 0.0
    for p in points:
        d = min(distance(p, c) for c in final_centroids)
        total_dist += d
    avg_dist = total_dist / len(points)

    return OptimizationResponse(
        optimal_locations=final_centroids, average_distance=avg_dist
    )
