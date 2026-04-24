import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicOrganization, getPublicOrganizationAnimals } from "../services/platformService";
import type { Animal, Organization } from "../types/platform";
import "../styles/Portal.css";

function OrganizationPublicProfile() {
  const { organizationId = "" } = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);

  useEffect(() => {
    getPublicOrganization(organizationId).then(setOrganization).catch(() => setOrganization(null));
    getPublicOrganizationAnimals(organizationId).then(setAnimals).catch(() => setAnimals([]));
  }, [organizationId]);

  if (!organization) {
    return <div className="empty-state">Organization profile not found.</div>;
  }

  const featuredAnimals = animals.slice(0, 3);

  const donationDetails = [
    organization.bank_account_title ? `Account Title: ${organization.bank_account_title}` : null,
    organization.bank_account_number ? `Account Number or Wallet ID: ${organization.bank_account_number}` : null,
  ].filter(Boolean);

  return (
    <div className="portal-page" style={{ padding: "32px" }}>
      <div className="portal-header">
        <div>
          <h1>{organization.name}</h1>
          <p>{organization.city || organization.address || "Rescue organization profile"}</p>
        </div>
      </div>

      <section className="panel-card">
        {organization.image ? (
          <div className="detail-hero-media-shell">
            <img className="detail-hero-image detail-hero-image-fit" src={organization.image} alt={organization.name} />
          </div>
        ) : null}
        <h2>About</h2>
        <p>{organization.description || "This organization has not added a public description yet."}</p>
        <div className="card-grid">
          <div className="status-card">
            <strong>Contact Email</strong>
            <p>{organization.contact_email || organization.user_email || "Not shared publicly"}</p>
          </div>
          <div className="status-card">
            <strong>Phone</strong>
            <p>{organization.phone_number || "Not shared publicly"}</p>
          </div>
          <div className="status-card">
            <strong>Address</strong>
            <p>{organization.address || "Address not shared"}</p>
          </div>
          <div className="status-card">
            <strong>Capacity</strong>
            <p>{organization.capacity ? `${organization.capacity} animals` : "Not shared publicly"}</p>
          </div>
          <div className="status-card">
            <strong>Service Radius</strong>
            <p>{organization.radius ? `${organization.radius} km` : "Not shared publicly"}</p>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <h2>Animals In Their Care</h2>
            <p className="meta-line">Showing up to three profiles here with the full list on a separate page.</p>
          </div>
          {animals.length > featuredAnimals.length ? (
            <Link className="secondary-btn" to={`/animals/browse?organizationId=${organization.id}`}>More Animals</Link>
          ) : null}
        </div>
        <div className="card-grid">
          {featuredAnimals.length ? featuredAnimals.map((animal) => (
            <article className="animal-card" key={animal.id}>
              {animal.image ? <img className="card-media" src={animal.image} alt={animal.name} /> : null}
              <span className="badge">{animal.status}</span>
              <h3>{animal.name}</h3>
              <p>{animal.description || "No public description has been shared yet."}</p>
              <div className="feed-actions">
                <Link className="secondary-btn" to={`/animals/${animal.id}`}>View Animal</Link>
              </div>
            </article>
          )) : <div className="empty-state">No animal profiles are available yet.</div>}
        </div>
      </section>

      <section className="panel-card">
        <h2>Donation Information</h2>
        <p className="meta-line">
          {donationDetails.length ? donationDetails.join(" | ") : "This organization has not shared donation information yet."}
        </p>
      </section>
    </div>
  );
}

export default OrganizationPublicProfile;
