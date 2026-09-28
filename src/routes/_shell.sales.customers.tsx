import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { LoadingState, ErrorState } from "@/components/app/states";
import { customersApi, type CustomerRow } from "@/api/customers";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_shell/sales/customers")({
  head: () => ({
    meta: [
      { title: "Customers · RMC Command Center" },
      { name: "description", content: "Customer accounts, credit terms, sites and active concrete orders." },
      { property: "og:title", content: "Customers · RMC Command Center" },
      { property: "og:description", content: "Customer accounts, credit terms, sites and active concrete orders." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list().then((r) => r.data) });

  if (customers.isLoading) return <LoadingState rows={5} />;
  if (customers.error || !customers.data)
    return <ErrorState message="Customers could not be loaded." onRetry={() => void customers.refetch()} />;

  const columns: Column<CustomerRow>[] = [
    { key: "name", header: "Customer", cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: "contact", header: "Contact Person", cell: (r) => r.contactPerson },
    { key: "phone", header: "Phone", cell: (r) => r.phone },
    { key: "email", header: "Email", cell: (r) => <span className="text-muted-foreground">{r.email}</span> },
    { key: "gstin", header: "GSTIN", cell: (r) => r.gstin },
    { key: "credit", header: "Credit Days", align: "right", cell: (r) => r.creditDays, sortValue: (r) => r.creditDays },
    { key: "limit", header: "Credit Limit", align: "right", cell: (r) => inr(r.creditLimit), sortValue: (r) => r.creditLimit },
    { key: "sites", header: "Sites", align: "right", cell: (r) => r.sites.length },
    { key: "active", header: "Active Orders", align: "right", cell: (r) => r.activeOrders, sortValue: (r) => r.activeOrders },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="Accounts, credit terms and delivery sites" />
      <DataTable
        columns={columns}
        rows={customers.data}
        rowKey={(r) => r.id}
        emptyTitle="No customers yet"
        emptyDescription="Customer accounts will appear here once created."
      />
    </div>
  );
}
