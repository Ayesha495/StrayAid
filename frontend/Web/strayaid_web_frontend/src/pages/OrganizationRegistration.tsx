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
  latitude: 0,
  longitude: 0,
  address: "",
  phone_number: "",
  contact_email: "",
};

function OrganizationRegistration() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [form, setForm] = useState(initialForm);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    getOrganizationProfile()
      .then((profile) => {
        setForm({
          name: profile.name,
          description: profile.description,
          latitude: profile.latitude,
          longitude: profile.longitude,
          address: profile.address,
          phone_number: profile.phone_number,
          contact_email: profile.contact_email,
        });
        setHasProfile(true);
      })
      .catch(() => setHasProfile(false));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (hasProfile) {
        await updateOrganizationProfile(form);
        await syncCurrentUser();
        alert("Organization profile updated");
      } else {
        await createOrganizationProfile(form);
        await syncCurrentUser();
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
          <p>Set your rescue identity and location so nearby cases can find your team.</p>
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
        </div>
        <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
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
