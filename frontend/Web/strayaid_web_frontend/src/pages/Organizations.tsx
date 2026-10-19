import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { BadgeCheck, Building2, MapPin, PawPrint, Phone, Search } from "lucide-react";
import { getDirectory } from "../services/socialService";
import { getPublicAnimals } from "../services/platformService";
import { useApi } from "../hooks/useApi";
import Avatar from "../ui/Avatar";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { errorMessage } from "../utils/errors";
import type { Animal } from "../types/platform";
import type { DirectoryOrganization } from "../types/api";
import "./Organizations.css";

const ISLAMABAD: [number, number] = [33.6844, 73.0479];

function OrgCard({ item, animals }: { item: DirectoryOrganization; animals: Animal[] }) {
  const photos = animals.filter((animal) => animal.image).slice(0, 3);
  const inCare = animals.filter((animal) => animal.status !== "adopted").length;
  return (
    <article className="card org-card">
      <Link to={`/organizations/${item.id}`} className="org-card-cover" aria-hidden="true" tabIndex={-1}>
        {photos.length ? photos.map((animal) => <img key={animal.id} src={animal.image ?? ""} alt="" loading="lazy" />) : <span className="org-card-cover-empty" />}
      </Link>
      <div className="org-card-body">
        <span className="org-card-logo"><Avatar name={item.name} src={item.image} size={56} square /></span>
        <Link to={`/organizations/${item.id}`} className="org-card-name">
          <span className="truncate">{item.name}</span>
          {item.is_verified ? <BadgeCheck size={16} className="org-verified" aria-label="Verified" /> : null}
        </Link>
        <div className="org-card-chips">
          <span className={`chip ${item.is_available ? "chip-green chip-dot" : "chip-outline"}`}>{item.is_available ? "Taking cases" : "Not taking cases"}</span>
          <span className="chip chip-amber"><PawPrint size={11} /> {inCare} in care</span>
        </div>
        {item.address || item.city ? <p className="org-card-line"><MapPin size={14} /> <span className="truncate">{item.address || item.city}</span></p> : null}
        <div className="org-card-actions">
          <Link to={`/organizations/${item.id}`} className="btn btn-secondary btn-sm">View profile</Link>
          {item.phone ? <a href={`tel:${item.phone}`} className="btn btn-ghost btn-sm" aria-label={`Call ${item.name}`}><Phone size={14} /> Call</a> : null}
        </div>
      </div>
    </article>
  );
}

/** Every rescue organization on StrayAid: searchable cards beside a map of where they work. */
function Organizations() {
  const directory = useApi(getDirectory);
  const animals = useApi(() => getPublicAnimals());
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const all = useMemo(() => directory.data ?? [], [directory.data]);
  const cities = useMemo(() => [...new Set(all.map((item) => item.city).filter(Boolean))].sort(), [all]);
  const byOrg = useMemo(() => {
    const map = new Map<number, Animal[]>();
    (animals.data ?? []).forEach((animal) => {
      const id = animal.organization?.id;
      if (id) map.set(id, [...(map.get(id) ?? []), animal]);
    });
    return map;
  }, [animals.data]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((item) => !city || item.city === city)
      .filter((item) => !availableOnly || item.is_available)
      .filter((item) => !needle || [item.name, item.city, item.address].some((field) => field?.toLowerCase().includes(needle)));
  }, [all, query, city, availableOnly]);
  const mapped = visible.filter((item) => item.latitude !== null && item.longitude !== null);

  return (
    <div className="page orgs-page">
      <div className="page-header">
        <div>
          <h1>Rescue teams</h1>
          <p>Shelters and rescue teams answering reports on StrayAid. Follow one to see their rescues in your feed.</p>
        </div>
      </div>

      <div className="toolbar orgs-toolbar">
        <label className="input-with-icon toolbar-search">
          <Search size={16} />
          <input className="input" type="search" placeholder="Name, city or area" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search organizations" />
        </label>
        <select className="select" style={{ width: "auto" }} value={city} onChange={(event) => setCity(event.target.value)} aria-label="City">
          <option value="">All cities</option>
          {cities.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" className="filter-pill" aria-pressed={availableOnly} onClick={() => setAvailableOnly(!availableOnly)}>
          Taking new cases
        </button>
      </div>

      <div className="orgs-layout">
        {directory.loading && !directory.data ? (
          <div className="org-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={260} />)}</div>
        ) : directory.error && !directory.data ? (
          <ErrorState message={errorMessage(directory.error)} onRetry={directory.reload} />
        ) : visible.length ? (
          <div className="org-grid">
            {visible.map((item) => <OrgCard key={item.id} item={item} animals={byOrg.get(item.id) ?? []} />)}
          </div>
        ) : (
          <EmptyState icon={<Building2 size={22} />} title="No organizations match" message="Try another city or search." />
        )}

        <aside className="card orgs-map" aria-label="Map of rescue teams">
          {/* Remounts when the results change so the view always fits every pin. */}
          <MapContainer
            key={mapped.map((item) => item.id).join(",")}
            center={ISLAMABAD}
            zoom={11}
            bounds={mapped.length > 1 ? mapped.map((item) => [item.latitude ?? 0, item.longitude ?? 0] as [number, number]) : undefined}
            boundsOptions={{ padding: [32, 32] }}
            scrollWheelZoom={false}
            style={{ height: "100%" }}
          >
            <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
            {mapped.map((item) => (
              <CircleMarker
                key={item.id}
                center={[item.latitude ?? 0, item.longitude ?? 0]}
                radius={9}
                pathOptions={{ color: "#fff", weight: 2, fillColor: item.is_available ? "#1e6b56" : "#8590a0", fillOpacity: 1 }}
              >
                <Popup><Link to={`/organizations/${item.id}`}>{item.name}</Link><br />{item.is_available ? "Taking cases" : "Not taking cases"}</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </aside>
      </div>
    </div>
  );
}

export default Organizations;
