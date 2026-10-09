import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/app/filter-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ordersRepo, type OrderRow } from "@/data/repositories/orders";
import { customersApi } from "@/api/customers";
import { useAuth } from "@/auth/auth-context";
import { useListQuery } from "@/hooks/use-list-query";
import { GRADES } from "@/lib/mock-data";
import { cum } from "@/lib/format";
import type { PoStatus } from "@/types";

export const Route = createFileRoute("/_shell/sales/orders/")({
  head: () => ({
    meta: [
      { title: "Purchase Orders · RMC Command Center" },
      { name: "description", content: "Search, filter and manage every concrete purchase order." },
      { property: "og:title", content: "Purchase Orders · RMC Command Center" },
      { property: "og:description", content: "Search, filter and manage every concrete purchase order." },
    ],
  }),
  component: OrdersPage,
});

const STATUSES: PoStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const readOnly = user?.role === "owner";
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);

  const { params, updateParams, query: orders } = useListQuery(
    ["orders"],
    (params) => ordersRepo.list(params).then((r) => r.data)
  );

  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list().then((r) => r.data) });

  const submit = useMutation({
    mutationFn: (id: string) => ordersRepo.submit(id, user?.name ?? "Sales"),
    onSuccess: () => {
      toast.success("PO submitted successfully");
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => ordersRepo.remove(id),
    onSuccess: () => {
      toast.success("Draft PO deleted");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (orders.isLoading || customers.isLoading) return <LoadingState rows={6} />;
  if (orders.error || !orders.data) return <ErrorState message="Purchase orders could not be loaded." onRetry={() => void orders.refetch()} />;

  const columns: Column<OrderRow>[] = [
    { key: "po", header: "PO Number", cell: (r) => <span className="font-medium">{r.poNumber}</span>, sortValue: (r) => r.poNumber },
    { key: "customer", header: "Customer", cell: (r) => r.customerName, sortValue: (r) => r.customerName },
    { key: "site", header: "Site", cell: (r) => <span className="text-muted-foreground">{r.siteName}</span> },
    { key: "grade", header: "Grade", cell: (r) => r.grade, sortValue: (r) => r.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity), sortValue: (r) => r.quantity },
    { key: "date", header: "Delivery Date", cell: (r) => r.deliveryDate, sortValue: (r) => r.deliveryDate },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "by", header: "Created By", cell: (r) => <span className="text-muted-foreground">{r.createdBy}</span> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/sales/orders/$poId", params: { poId: r.id } })}>
            View
          </Button>
          {!readOnly && r.status === "DRAFT" && (
            <>
              <Button size="sm" variant="outline" onClick={() => submit.mutate(r.id)}>
                Submit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteTarget(r)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle={readOnly ? "Read-only view of the full order book" : "Create, submit and track customer orders"}
        actions={
          !readOnly && (
            <Button onClick={() => void navigate({ to: "/sales/orders/new" })}>
              <Plus className="size-4" /> Create PO
            </Button>
          )
        }
      />

      <FilterBar
        search={params.q}
        onSearchChange={(q) => updateParams({ q })}
        searchPlaceholder="Search PO number or customer"
        filters={[
          {
            key: "customer",
            placeholder: "Customer",
            value: params['customer'],
            options: (customers.data ?? []).map((c) => ({ label: c.name, value: c.id })),
            onChange: (customer) => updateParams({ customer }),
          },
          {
            key: "grade",
            placeholder: "Grade",
            value: params['grade'],
            options: GRADES.map((g) => ({ label: g, value: g })),
            onChange: (grade) => updateParams({ grade }),
          },
          {
            key: "status",
            placeholder: "Status",
            value: params['status'],
            options: STATUSES.map((s) => ({ label: s.replace(/_/g, " "), value: s })),
            onChange: (status) => updateParams({ status }),
          }
        ]}
      />

      <DataTable
        columns={columns}
        rows={orders.data}
        rowKey={(r) => r.id}
        initialPageSize={10}
        emptyTitle="No orders match these filters"
        emptyDescription="Adjust the filters above or create a new purchase order."
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.poNumber} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}>Delete draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
