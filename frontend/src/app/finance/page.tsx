"use client";
import { FinanceView } from "@/components/views/FinanceView";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/lib/hooks/useAuth";

export default function FinancePage() {
  const { currentUser } = useAuth();
  return (
    <DashboardLayout title="Finanzen">
      <FinanceView />
    </DashboardLayout>
  );
}
