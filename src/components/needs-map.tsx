'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NeedEvent } from '@/lib/needs';

const WILLIAMSBURG: [number, number] = [37.2707, -76.7075];
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Leaflet + OpenStreetMap. Events at the same spot share one numbered pin. Browser-only. */
export default function NeedsMap({ events }: { events: NeedEvent[] }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!element.current || map.current) return;
    map.current = L.map(element.current, { scrollWheelZoom: false }).setView(WILLIAMSBURG, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const spots = new Map<string, NeedEvent[]>();
    for (const event of events) {
      if (!event.point) continue;
      const key = `${event.point.lat.toFixed(4)},${event.point.lng.toFixed(4)}`;
      spots.set(key, [...(spots.get(key) ?? []), event]);
    }
    const bounds: L.LatLngTuple[] = [];
    for (const group of spots.values()) {
      const { lat, lng, precision } = group[0].point!;
      const open = group.reduce((sum, e) => sum + e.open_spots, 0);
      const full = open === 0;
      const icon = L.divIcon({
        className: '',
        html: `<span class="needs-pin${full ? ' is-full' : ''}${precision === 'city' ? ' is-city' : ''}">${group.length}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -16],
      });
      const list = group
        .map(
          (e) =>
            `<li><a href="/events/${encodeURIComponent(e.id)}">${escape(e.title)}</a><br/><small>${escape(e.group_name)} · ${new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${e.open_spots} of ${e.total_spots} spots open</small></li>`,
        )
        .join('');
      const where =
        precision === 'city'
          ? `Approximate: ${escape(group[0].city)} (address not mapped)`
          : precision === 'demo'
            ? 'Fictional demo venue'
            : escape(group[0].venue);
      L.marker([lat, lng], {
        icon,
        keyboard: true,
        title: `${group.length} event${group.length === 1 ? '' : 's'}, ${open} open spots`,
      })
        .bindPopup(`<div class="needs-popup"><strong>${where}</strong><ul>${list}</ul></div>`)
        .addTo(layer.current);
      bounds.push([lat, lng]);
    }
    if (bounds.length === 1) map.current.setView(bounds[0], 14);
    else if (bounds.length > 1) map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [events]);
  return (
    <div ref={element} className="needs-map" role="region" aria-label="Map of upcoming events" />
  );
}
