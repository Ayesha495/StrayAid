import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import OrgProfileForm from "../components/OrgProfileForm";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import { LoadingRows } from "../ui/States";

/** "Edit profile" from the kebab menu on a team's own public page. */
function OrganizationEdit() {
  const toast = useToast();
  const { isOrganization, organization, setOrganization } = useShell();

  if (!isOrganization) return <Navigate to="/settings" replace />;

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      {organization ? (
        <Link to={`/organizations/${organization.id}`} className="link small row" style={{ gap: 4, marginBottom: 12, display: "inline-flex" }}>
          <ArrowLeft size={14} /> Back to your page
        </Link>
      ) : null}
      <div className="page-header">
        <div>
          <h1>Edit profile</h1>
          <p>Changes show on your public page as soon as you save.</p>
        </div>
        {organization ? (
          <Link to={`/organizations/${organization.id}`} className="btn btn-secondary"><Eye size={16} /> View public page</Link>
        ) : null}
      </div>

      {organization ? (
        <OrgProfileForm
          organization={organization}
          onSaved={(saved) => {
            setOrganization(saved);
            toast({ title: "Profile saved" });
          }}
        />
      ) : (
        <LoadingRows rows={3} height={160} />
      )}
    </div>
  );
}

export default OrganizationEdit;
