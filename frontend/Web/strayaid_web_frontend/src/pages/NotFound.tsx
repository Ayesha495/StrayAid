import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../ui/States";
import { useCurrentUser, getDefaultAuthenticatedRoute } from "../services/authService";

function NotFound() {
  const user = useCurrentUser();
  const home = user ? getDefaultAuthenticatedRoute(user) : "/";
  return (
    <div className="page" style={{ paddingTop: 80 }}>
      <EmptyState
        headingLevel={1}
        icon={<Compass size={22} />}
        title="Page not found"
        message="This page doesn't exist or has moved."
        action={<Link to={home} className="btn btn-primary btn-sm">Go home</Link>}
      />
    </div>
  );
}

export default NotFound;
