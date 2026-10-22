import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ComponentType } from "react";
import {
  LayoutDashboard, ClipboardList, PawPrint, Newspaper, LogOut, FileText, Wallet, MessageSquare,
  Building2, Heart, HandHeart, Settings, ArrowRight,
} from "lucide-react";
import { clearSession, useCurrentUser } from "../services/authSevice";
import { getOrganizationProfile } from "../services/platformService";
import { LogoMark } from "../ui/Logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import MenuToggleIcon from "./MenuToggleIcon";

type AppSidebarProps = {
  isCollapsed: boolean;
  isMobile: boolean;
  onToggle: () => void;
};

type Item = { to: string; label: string; icon: ComponentType<{ size?: number }>; end?: boolean };
type Group = { title: string; items: Item[] };

const ORG_GROUPS: Group[] = [
  {
    title: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/cases", label: "Rescue requests", icon: ClipboardList },
      { to: "/animals", label: "Rescued animals", icon: PawPrint, end: true },
      { to: "/applications", label: "Applications", icon: FileText },
      { to: "/funds", label: "Funds", icon: Wallet },
    ],
  },
  {
    title: "Community",
    items: [
      { to: "/feed", label: "Community posts", icon: Newspaper },
      { to: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
];

const MEMBER_GROUPS: Group[] = [
  {
    title: "Explore",
    items: [
      { to: "/feed", label: "Community posts", icon: Newspaper },
      { to: "/animals/browse", label: "Animals", icon: PawPrint },
      { to: "/organizations", label: "Rescue teams", icon: Building2, end: true },
    ],
  },
  {
    title: "You",
    items: [
      { to: "/my-reports", label: "My reports", icon: ClipboardList },
      { to: "/following", label: "Following", icon: Heart },
      { to: "/my-applications", label: "Adopt & sponsor", icon: HandHeart },
      { to: "/messages", label: "Messages", icon: MessageSquare },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, item: Item) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function AppSidebar({ isCollapsed, isMobile, onToggle }: AppSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentUser = useCurrentUser();
  const isOrganization = currentUser?.role === "organization";
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOrganization) return;
    getOrganizationProfile()
      .then((profile) => setOrganizationName(profile.name))
      .catch(() => setOrganizationName(null));
  }, [isOrganization]);

  const displayName = isOrganization ? (organizationName || "Organization account") : (currentUser?.username || "Your account");
  const groups = isOrganization ? ORG_GROUPS : MEMBER_GROUPS;
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";

  const handleLogout = () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    clearSession();
    navigate("/login");
  };

  const handleLinkClick = () => {
    if (isMobile) onToggle();
  };

  return (
    <aside className={`dashboard-sidebar${isCollapsed ? " is-collapsed" : ""}`} aria-label="Main menu">
      <div className="sb-head">
        <Link to={isOrganization ? "/dashboard" : "/feed"} className="sb-brand" onClick={handleLinkClick}>
          <LogoMark size={24} />
          <span>StrayAid</span>
        </Link>
        {isMobile ? (
          <button className="sb-close" type="button" aria-label="Close menu" onClick={onToggle}>
            <MenuToggleIcon isOpen={true} />
          </button>
        ) : null}
      </div>

      <ScrollArea className="sb-scroll">
        <nav className="sb-nav">
          {groups.map((group) => (
            <div key={group.title} className="sb-group">
              <p className="sb-group-title">{group.title}</p>
              <ul>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={`sb-link${active ? " is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={handleLinkClick}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span className="sb-label">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {isOrganization ? null : (
          <Link to="/organization/register" className="sb-promo" onClick={handleLinkClick}>
            <strong>Run a rescue team?</strong>
            <span>Register it to receive cases near you.</span>
            <span className="sb-promo-cta">Register your team <ArrowRight size={13} aria-hidden="true" /></span>
          </Link>
        )}
      </ScrollArea>

      <div className="sb-foot">
        <Link
          to={isOrganization ? "/organization/register" : "/settings"}
          className="sb-account"
          title={displayName}
          onClick={handleLinkClick}
        >
          <span className="sb-avatar" aria-hidden="true">{initial}</span>
          <span className="sb-account-text">
            <strong>{displayName}</strong>
            <span>{isOrganization ? "Rescue team" : "Member"}</span>
          </span>
        </Link>
        <button className="sb-logout" type="button" onClick={handleLogout} aria-label="Log out" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;
