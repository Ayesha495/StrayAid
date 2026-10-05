import { Redirect } from "expo-router";

// The Report tab button opens the full-screen report flow in app/report (Stitch 7-9);
// this route only exists so the tab bar keeps its Report slot.
export default function ReportTab() {
  return <Redirect href="/report" />;
}
