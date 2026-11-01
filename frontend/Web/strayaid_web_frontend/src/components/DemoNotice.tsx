import { useEffect, useState } from "react";
import { getCommunityStats } from "../services/caseService";
import "./DemoNotice.css";

/** Says so plainly when the site is showing the seeded demo data, not real rescues. */
function DemoNotice() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    getCommunityStats().then((stats) => setDemo(Boolean(stats.demo_data))).catch(() => setDemo(false));
  }, []);

  if (!demo) return null;
  return (
    <p className="demo-notice" role="note">
      Demo data: the animals, rescues, people and organizations shown here are made up for a university project.
    </p>
  );
}

export default DemoNotice;
