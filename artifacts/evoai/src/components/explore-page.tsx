import { useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { ArrowLeft, Compass } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './explore-page.css';

type Coordinates = { lat: number; lng: number };
type ExplorePageProps = { onBack: () => void };

const START: Coordinates = { lat: 48.8566, lng: 2.3522 };
const PLACES: { name: string; position: Coordinates; zoom: number }[] = [
  { name: 'Paris', position: { lat: 48.8566, lng: 2.3522 }, zoom: 15 },
  { name: 'Kyoto', position: { lat: 35.0116, lng: 135.7681 }, zoom: 15 },
  { name: 'Lisbon', position: { lat: 38.7137, lng: -9.1394 }, zoom: 15 },
  { name: 'New York', position: { lat: 40.7306, lng: -73.9866 }, zoom: 15 },
];

const embedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();

function MapInteraction({
  onSelect,
  onCenterChange,
}: {
  onSelect: (position: Coordinates) => void;
  onCenterChange: (position: Coordinates) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
    moveend(event) {
      const center = event.target.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

function MapNavigator({ destination }: { destination: { position: Coordinates; zoom: number; id: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (destination) map.flyTo(destination.position, destination.zoom, { duration: 0.8 });
  }, [map, destination]);
  return null;
}

function streetViewUrl(position: Coordinates, key: string) {
  const params = new URLSearchParams({
    key,
    location: `${position.lat},${position.lng}`,
    radius: '250',
  });
  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

export function ExplorePage({ onBack }: ExplorePageProps) {
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [center, setCenter] = useState<Coordinates>(START);
  const [destination, setDestination] = useState<{ position: Coordinates; zoom: number; id: number } | null>(null);
  const streetViewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selected || !window.matchMedia('(max-width: 900px)').matches || !streetViewRef.current) return;
    const top = streetViewRef.current.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  }, [selected]);

  return (
    <main className="explore-page">
      <div className="explore-inner">
        <nav className="explore-topbar" aria-label="Explore navigation">
          <button className="explore-back" type="button" onClick={onBack} data-testid="button-back-home">
            <ArrowLeft aria-hidden="true" /> Back home
          </button>
          <span className="explore-brand" aria-label="Evoke AI">evoke <span>ai</span></span>
        </nav>

        <header className="explore-heading">
          <div>
            <p className="explore-kicker">Explore / the real world</p>
            <h1>A doorway to <em>somewhere.</em></h1>
          </div>
          <p className="explore-intro">
            Not every journey begins with an imagined world. Wander the map, choose a spot, and step into its streets right here.
          </p>
        </header>

        <div className="explore-workspace">
          <section className="explore-panel" aria-label="Interactive world map">
            <div className="explore-panel-head">
              <div>
                <p className="explore-label">Find your place</p>
                <h2>The map</h2>
              </div>
              <span className="explore-panel-index">01 / 02</span>
            </div>
            <div className="explore-map-wrap">
              <MapContainer
                className="explore-map"
                center={[START.lat, START.lng] as LatLngExpression}
                zoom={13}
                minZoom={2}
                maxZoom={19}
                scrollWheelZoom
                keyboard
                zoomControl
                aria-label="Map. Pan or zoom, then click a location to open Street View."
              >
                <TileLayer
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
                  maxZoom={19}
                />
                <MapInteraction onSelect={setSelected} onCenterChange={setCenter} />
                <MapNavigator destination={destination} />
                {selected ? (
                  <CircleMarker
                    center={[selected.lat, selected.lng]}
                    radius={9}
                    pathOptions={{ color: '#f5f7df', weight: 3, fillColor: '#7a549c', fillOpacity: 1 }}
                    interactive={false}
                  />
                ) : null}
              </MapContainer>
              <div className="explore-map-note">Drag to pan · Scroll or pinch to zoom · Click a street</div>
            </div>
            <div className="explore-panel-foot">
              <p>
                <strong>Choose any point on the map.</strong><br />
                The closest available street scene opens alongside it.
              </p>
              <button
                className="explore-center"
                type="button"
                onClick={() => setSelected({ ...center })}
                data-testid="button-view-map-center"
              >
                View map center
              </button>
            </div>
          </section>

          <section ref={streetViewRef} className="explore-panel" aria-label="Street View">
            <div className="explore-panel-head">
              <div>
                <p className="explore-label">Step inside</p>
                <h2>Street View</h2>
              </div>
              <span className="explore-panel-index">02 / 02</span>
            </div>
            <div className="explore-view-wrap">
              {selected && embedKey ? (
                <iframe
                  key={`${selected.lat},${selected.lng}`}
                  src={streetViewUrl(selected, embedKey)}
                  title={`Google Street View near ${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                  data-testid="iframe-street-view"
                />
              ) : (
                <div className="explore-view-empty" role="status" data-testid={embedKey ? 'status-select-location' : 'status-embed-setup'}>
                  <div className="explore-compass"><Compass aria-hidden="true" /></div>
                  {embedKey ? (
                    <>
                      <h3>The street is yours to find.</h3>
                      <p>Pick a point on the map to look around without leaving Evoke.</p>
                    </>
                  ) : (
                    <>
                      <h3>The map is ready. Street View needs a key.</h3>
                      <p>Add <code>VITE_GOOGLE_MAPS_EMBED_KEY</code> to enable Google Maps Embed API Street View. You can still explore and select places on the map.</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="explore-panel-foot">
              <p aria-live="polite" data-testid="text-selected-location">
                <strong>{selected ? 'Looking near your chosen point' : 'Waiting for a place'}</strong>
                {selected ? (
                  <span className="explore-coordinates">{selected.lat.toFixed(5)}°, {selected.lng.toFixed(5)}°</span>
                ) : (
                  <span className="explore-coordinates">A street-level view is one click away.</span>
                )}
              </p>
              <p>{selected ? 'No imagery here? Try clicking a nearby road.' : 'Some places may not have Street View imagery.'}</p>
            </div>
          </section>
        </div>

        <div className="explore-ideas" aria-label="Places to start exploring">
          <span className="explore-label">Or start near</span>
          {PLACES.map((place) => (
            <button
              key={place.name}
              type="button"
              className="explore-city"
              onClick={() => {
                setDestination({ position: place.position, zoom: place.zoom, id: Date.now() });
                setSelected(place.position);
              }}
              data-testid={`button-visit-${place.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {place.name} <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <p className="explore-disclaimer">
          Map data © OpenStreetMap contributors. Street imagery is provided by Google where available. Map picks are approximate; try a nearby road if a scene cannot be shown.
        </p>
      </div>
    </main>
  );
}

export default ExplorePage;