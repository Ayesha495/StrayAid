import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "../components/AppSidebar";
import "../components/DashboardLayout.css";
import LocationPicker from "../components/LocationPicker";
import { syncCurrentUser, useCurrentUser } from "../services/authSevice";
import { createOrganizationProfile, getOrganizationProfile, updateOrganizationProfile } from "../services/platformService";
import "../styles/Portal.css";

const initialForm = {
  name: "",
  description: "",
  image: null as File | null,
  latitude: 0,
  longitude: 0,
  address: "",
  city: "",
  capacity: 0,
  radius: 0,
  phone_number: "",
  contact_email: "",
  bank_account_title: "",
  bank_account_number: "",
};

function OrganizationRegistration() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [form, setForm] = useState(initialForm);
  const [hasProfile, setHasProfile] = useState(false);
  const [existingImage, setExistingImage] = useState<string | null>(null);

  useEffect(() => {
    getOrganizationProfile()
      .then((profile) => {
        setForm({
          name: profile.name,
          description: profile.description,
          image: null,
          latitude: profile.latitude,
          longitude: profile.longitude,
          address: profile.address,
          city: profile.city ?? "",
          capacity: profile.capacity ?? 0,
          radius: profile.radius ?? 0,
          phone_number: profile.phone_number,
          contact_email: profile.contact_email,
          bank_account_title: profile.bank_account_title ?? "",
          bank_account_number: profile.bank_account_number ?? "",
        });
        setExistingImage(profile.image ?? null);
        setHasProfile(true);
      })
      .catch(() => setHasProfile(false));
  }, []);

  const buildPayload = () => {
    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value);
        return;
      }

      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    return formData;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const payload = buildPayload();

      if (hasProfile) {
        const profile = await updateOrganizationProfile(payload);
        await syncCurrentUser();
        setExistingImage(profile.image ?? null);
        setForm((current) => ({ ...current, image: null }));
        alert("Organization profile updated");
      } else {
        const profile = await createOrganizationProfile(payload);
        await syncCurrentUser();
        setExistingImage(profile.image ?? null);
        alert("Organization profile created");
        setHasProfile(true);
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error(error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response
          ? JSON.stringify(error.response.data)
          : "Could not save organization profile";
      alert(message);
    }
  };

  const pageContent = (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1>Organization Profile</h1>
          <p>Set your rescue identity, service range, donation information, and public image so people understand who you are and how you help.</p>
        </div>
      </div>

      <form className="panel-card portal-form" onSubmit={handleSubmit}>
        <LocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          address={form.address}
          onLocationChange={({ latitude, longitude }) => setForm((current) => ({ ...current, latitude, longitude }))}
          onAddressChange={(address) => setForm((current) => ({ ...current, address }))}
        />

        <div className="portal-form-grid">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Phone<input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></label>
          <label>Contact Email<input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
          <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label>
            Capacity
            <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) || 0 })} />
          </label>
          <label>
            Service Radius (km)
            <input type="number" min="0" step="0.1" value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) || 0 })} />
          </label>
          <label>
            Organization Image
            <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] ?? null })} />
          </label>
        </div>

        {existingImage ? (
          <div className="panel-card compact-state">
            <strong>Current Public Image</strong>
            <img className="detail-hero-image" src={existingImage} alt={form.name || "Organization"} />
          </div>
        ) : null}

        <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>

        <section className="panel-card compact-state">
          <h2>Donation Information</h2>
          <p className="meta-line">This can be a bank account, digital wallet, or any verified donation destination your organization uses.</p>
          <div className="portal-form-grid">
            <label>
              Donation Account Title
              <input value={form.bank_account_title} onChange={(e) => setForm({ ...form, bank_account_title: e.target.value })} />
            </label>
            <label>
              Donation Account Number or Wallet ID
              <input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
            </label>
          </div>
        </section>

        <div className="portal-actions">
          <button className="primary-btn" type="submit">{hasProfile ? "Update Profile" : "Create Profile"}</button>
        </div>
      </form>
    </div>
  );

  if (currentUser) {
    return (
      <div className="dashboard-shell">
        <AppSidebar />
        <main className="dashboard-content">
          {pageContent}
        </main>
      </div>
    );
  }

  return pageContent;
}

export default OrganizationRegistration;
