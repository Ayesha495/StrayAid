import { Outlet } from "react-router-dom";

/** Wraps the newer pages so their design-system base styles (ds.css) apply only to them. */
function DsScope() {
  return (
    <div className="ds ds-page">
      <Outlet />
    </div>
  );
}

export default DsScope;
