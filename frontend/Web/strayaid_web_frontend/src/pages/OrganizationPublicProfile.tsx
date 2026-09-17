import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Circle, MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  BadgeCheck,
  Check,
  Mail,
  MapPin,
  PhoneCall,
  Ruler,
  Share2,
  Users,
  Wallet,
} from "lucide-react";
import AnimalCard from "../components/AnimalCard";
import SponsorModal from "../components/SponsorModal";
import { getPublicOrganization, getPublicOrganizationAnimals } from "../services/platformService";
import type { Animal, DonationInfo, Organization } from "../types/platform";
import "../styles/Portal.css";
import "../styles/PublicProfile.css";

type AnimalFilter = "all" | "adoptable" | "recovering" | "rescued";

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const getZoomForRadius = (radiusKm?: number) => {
  if (!radiusKm) return 13;
  if (radiusKm <= 5) return 12;
  if (radiusKm <= 15) return 10;
  if (radiusKm <= 40) return 9;
  return 7;
};

function PublicProfileTopbar() {
  return (
    <header className="public-profile-topbar">
      <Link to="/" className="public-profile-logo">🐾 StrayAid</Link>
      <nav className="public-profile-topnav">
        <Link to="/feed">Public Feed</Link>
        <Link to="/animals/browse">Browse Animals</Link>
        <Link to="/login" className="public-profile-login-link">Organization Login</Link>
      </nav>
    </header>
  );
}

function OrganizationPublicProfile() {
  const { organizationId = "" } = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [activeFilter, setActiveFilter] = useState<AnimalFilter>("all");
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const [openAdoptionId, setOpenAdoptionId] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    getPublicOrganization(organizationId).then(setOrganization).catch(() => setOrganization(null));
    getPublicOrganizationAnimals(organizationId).then(setAnimals).catch(() => setAnimals([]));
  }, [organizationId]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: organization?.name ?? "StrayAid rescue organization",
      text: "See this rescue organization's real-time profile on StrayAid.",
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Share sheet dismissed by the visitor; nothing else to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 2000);
    } catch {
      window.alert("Copy this page's link from your browser's address bar to share it.");
    }
  };

  if (!organization) {
    return (
      <div className="public-profile-page">
        <PublicProfileTopbar />
        <div className="public-profile-content">
          <div className="empty-state">Organization profile not found.</div>
        </div>
      </div>
    );
  }

  const locationLine = [organization.city, organization.address].filter(Boolean).join(", ") || "Location not shared publicly";
  const hasCoordinates =
    Number.isFinite(organization.latitude) &&
    Number.isFinite(organization.longitude) &&
    (organization.latitude !== 0 || organization.longitude !== 0);
  const mapCenter: [number, number] = [organization.latitude, organization.longitude];

  const hasBankInfo = Boolean(organization.bank_name || organization.bank_account_title || organization.bank_account_number);
  const donationInfo: DonationInfo | null = hasBankInfo
    ? {
        bank: organization.bank_name ?? "",
        account_name: organization.bank_account_title ?? "",
        account_number: organization.bank_account_number ?? "",
      }
    : null;

  const allCount = animals.length;
  const adoptableCount = animals.filter((animal) => animal.status === "adoptable").length;
  const recoveringCount = animals.filter((animal) => animal.status === "recovering").length;
  const rescuedCount = animals.filter((animal) => animal.status === "rescued").length;

  const filteredAnimals = activeFilter === "all" ? animals : animals.filter((animal) => animal.status === activeFilter);
  const featuredAnimals = filteredAnimals.slice(0, 3);

  const filterChips: { key: AnimalFilter; label: string; count: number }[] = [
    { key: "all", label: "All Animals", count: allCount },
    { key: "adoptable", label: "Adoptable", count: adoptableCount },
    { key: "recovering", label: "In Medical Recovery", count: recoveringCount },
    { key: "rescued", label: "Emergency Foster", count: rescuedCount },
  ];

  return (
    <div className="public-profile-page">
      <PublicProfileTopbar />

      <div className="public-profile-content portal-page">
        <section className="public-hero" style={organization.image ? { backgroundImage: `url(${organization.image})` } : undefined}>
          <div className="public-hero-scrim" />
          <div className="public-hero-content">
            <div className="public-hero-top">
              <div className="public-hero-badge" aria-hidden="true">{getInitials(organization.name)}</div>
              <div className="public-hero-heading">
                <div className="public-hero-name-row">
                  <h1>{organization.name}</h1>
                  {organization.is_verified ? (
                    <span className="badge badge-green public-hero-verified">
                      <BadgeCheck size={13} /> Verified
                    </span>
                  ) : null}
                </div>
                <p className="public-hero-location"><MapPin size={14} /> {locationLine}</p>
              </div>
            </div>
            <div className="public-hero-actions">
              <button type="button" className="primary-btn" onClick={() => setIsDonateOpen(true)}>
                <Wallet size={16} /> Donate to Hub
              </button>
              {organization.phone_number ? (
                <a className="secondary-btn public-hero-btn-light" href={`tel:${organization.phone_number}`}>
                  <PhoneCall size={16} /> Emergency Call
                </a>
              ) : null}
              <button
                type="button"
                className="icon-btn public-hero-share"
                onClick={handleShare}
                aria-label="Share this organization profile"
              >
                {shareStatus === "copied" ? <Check size={16} /> : <Share2 size={16} />}
              </button>
              {shareStatus === "copied" ? <span className="public-hero-share-confirm">Link copied</span> : null}
            </div>
          </div>
        </section>

        <section className="public-stat-strip">
          <div className="public-stat-chip">
            <span className="public-stat-icon public-stat-icon-blue"><Mail size={16} /></span>
            <div className="public-stat-body">
              <p className="public-stat-label">Contact Email</p>
              <p className="public-stat-value">{organization.contact_email || organization.user_email || "Not shared publicly"}</p>
            </div>
          </div>
          <div className="public-stat-chip">
            <span className="public-stat-icon public-stat-icon-green"><PhoneCall size={16} /></span>
            <div className="public-stat-body">
              <p className="public-stat-label">Emergency Phone</p>
              <p className="public-stat-value">{organization.phone_number || "Not shared publicly"}</p>
            </div>
          </div>
          <div className="public-stat-chip">
            <span className="public-stat-icon public-stat-icon-purple"><MapPin size={16} /></span>
            <div className="public-stat-body">
              <p className="public-stat-label">Shelter Address</p>
              <p className="public-stat-value">{organization.address || "Not shared publicly"}</p>
            </div>
          </div>
          <div className="public-stat-chip">
            <span className="public-stat-icon public-stat-icon-amber"><Users size={16} /></span>
            <div className="public-stat-body">
              <p className="public-stat-label">Shelter Capacity</p>
              <p className="public-stat-value">{organization.capacity ? `${organization.capacity} animals` : "Not shared publicly"}</p>
            </div>
          </div>
          <div className="public-stat-chip">
            <span className="public-stat-icon public-stat-icon-gray"><Ruler size={16} /></span>
            <div className="public-stat-body">
              <p className="public-stat-label">Service Radius</p>
              <p className="public-stat-value">{organization.radius ? `${organization.radius} km` : "Not shared publicly"}</p>
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="section-heading">
            <div>
              <h2>Mission</h2>
              <p className="meta-line">Why this rescue hub does what it does.</p>
            </div>
          </div>
          {organization.description ? (
            <blockquote className="public-mission-quote">{organization.description}</blockquote>
          ) : (
            <p className="meta-line">This organization has not added a public description yet.</p>
          )}
        </section>

        {hasCoordinates ? (
          <section className="panel-card">
            <div className="section-heading">
              <div>
                <h2>Coverage Area</h2>
                <p className="meta-line">
                  {organization.radius
                    ? `Approximate service radius of ${organization.radius} km around the shelter location.`
                    : "Shelter location on the map. No service radius has been shared."}
                </p>
              </div>
            </div>
            <div className="location-map-shell">
              <MapContainer
                center={mapCenter}
                zoom={getZoomForRadius(organization.radius)}
                scrollWheelZoom={false}
                className="location-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={mapCenter} icon={defaultIcon} />
                {organization.radius ? (
                  <Circle
                    center={mapCenter}
                    radius={organization.radius * 1000}
                    pathOptions={{ color: "#1c3a2e", fillColor: "#1c3a2e", fillOpacity: 0.12 }}
                  />
                ) : null}
              </MapContainer>
            </div>
          </section>
        ) : null}

        <section className="panel-card">
          <div className="section-heading">
            <div>
              <h2>Animals In Their Care</h2>
              <p className="meta-line">Filter by lifecycle stage to see who this organization is caring for right now.</p>
            </div>
            {filteredAnimals.length > featuredAnimals.length ? (
              <Link className="secondary-btn" to={`/animals/browse?organizationId=${organization.id}`}>More Animals</Link>
            ) : null}
          </div>

          <div className="public-filter-chips">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`public-filter-chip${activeFilter === chip.key ? " is-active" : ""}`}
                onClick={() => setActiveFilter(chip.key)}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>

          <div className="card-grid">
            {featuredAnimals.length ? featuredAnimals.map((animal) => {
              const canAdopt = animal.status === "adoptable" && Boolean(animal.adoption_info);

              return (
                <AnimalCard
                  key={animal.id}
                  animal={animal}
                  footer={
                    <>
                      <div className="feed-actions">
                        <Link className="secondary-btn" to={`/animals/${animal.id}`}>View Profile</Link>
                        {canAdopt ? (
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={() => setOpenAdoptionId(openAdoptionId === animal.id ? null : animal.id)}
                          >
                            Adopt {animal.name}
                          </button>
                        ) : null}
                      </div>
                      {canAdopt && openAdoptionId === animal.id && animal.adoption_info ? (
                        <div className="public-adoption-panel donation-detail-list">
                          <p>{animal.adoption_info.message}</p>
                          <p><strong>Phone:</strong> {animal.adoption_info.phone || "Not shared"}</p>
                          <p><strong>Email:</strong> {animal.adoption_info.email || "Not shared"}</p>
                        </div>
                      ) : null}
                    </>
                  }
                />
              );
            }) : (
              <div className="empty-state">
                {animals.length ? "No animals match this filter yet." : "No animal profiles are available yet."}
              </div>
            )}
          </div>
        </section>

        <footer className="public-profile-footer">
          <p className="meta-line">StrayAid connects verified rescue organizations with people who can help.</p>
          <nav className="public-profile-footer-links">
            <Link to="/">Home</Link>
            <Link to="/feed">Public Feed</Link>
            <Link to="/animals/browse">Browse Animals</Link>
          </nav>
        </footer>
      </div>

      <SponsorModal
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
        title={`Support ${organization.name}`}
        donationInfo={donationInfo}
      />
    </div>
  );
}

export default OrganizationPublicProfile;
