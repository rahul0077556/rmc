import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { LoadingState, ErrorState } from "@/components/app/states";
import { FilterBar } from "@/components/app/filter-bar";
import { useListQuery } from "@/hooks/use-list-query";
import { customersApi, type CustomerRow } from "@/api/customers";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_shell/sales/customers")({
  head: () => ({
    meta: [
      { title: "Customers · RMC Command Center" },
      { name: "description", content: "Customer accounts, credit terms, sites and active concrete orders." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { params, updateParams, query: customers } = useListQuery(["customers"], () => customersApi.list().then((r) => r.data));

  const filteredCustomers = useMemo(() => {
    if (!customers.data) return [];
    let list = customers.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(lower) || c.contactPerson.toLowerCase().includes(lower) || c.email.toLowerCase().includes(lower) || c.phone.includes(lower));
    }
    return list;
  }, [customers.data, params]);

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
      
      <FilterBar
        search={params.q}
        onSearchChange={(q) => updateParams({ q })}
        searchPlaceholder="Search Customer, Contact or Email..."
      />

      <DataTable
        columns={columns}
        rows={filteredCustomers}
        rowKey={(r) => r.id}
        emptyTitle="No customers found"
        emptyDescription="Customer accounts will appear here once created."
      />
    </div>
  );
}
