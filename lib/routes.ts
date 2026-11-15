export type RouteStop = {
  id: string;
  company: string;
  lat: number;
  lng: number;
  city: string | null;
  industry: string | null;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function orderByNearestNeighbor(
  stops: RouteStop[],
  startLat: number,
  startLng: number
): { ordered: RouteStop[]; totalKm: number } {
  if (stops.length === 0) return { ordered: [], totalKm: 0 };

  const remaining = [...stops];
  const ordered: RouteStop[] = [];
  let currentLat = startLat;
  let currentLng = startLng;
  let totalKm = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    totalKm += nearestDist;
    currentLat = next.lat;
    currentLng = next.lng;
  }

  return { ordered, totalKm };
}

export function buildGoogleMapsUrl(
  stops: RouteStop[],
  startLat: number,
  startLng: number
): string {
  const waypoints = stops.slice(0, 10).map((s) => `${s.lat},${s.lng}`);
  const origin = `${startLat},${startLng}`;
  const destination = origin;
  const waypointsParam = waypoints.join("|");

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  if (waypointsParam) {
    url.searchParams.set("waypoints", waypointsParam);
  }
  url.searchParams.set("travelmode", "driving");

  return url.toString();
}
