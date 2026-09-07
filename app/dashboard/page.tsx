import { Suspense } from "react";
import DashboardContent from "./DashboardContent";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading session…</p>}>
      <DashboardContent />
    </Suspense>
  );
}
