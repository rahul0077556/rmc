import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ordersApi, type OrderRow } from "@/api/orders";
import { customersApi } from "@/api/customers";
import { useAuth } from "@/auth/auth-context";
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
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("all");
  const [grade, setGrade] = useState("all");
  const [status, setStatus] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<OrderRow | null>(null);

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersApi.list().then((r) => r.data) });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list().then((r) => r.data) });

  const submit = useMutation({
    mutationFn: (id: string) => ordersApi.submit(id, user?.name ?? "Sales"),
    onSuccess: () => {
      toast.success("PO submitted successfully");
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => ordersApi.remove(id),
    onSuccess: () => {
      toast.success("Draft PO deleted");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const rows = useMemo(() => {
    let list = orders.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.poNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));
    }
    if (customer !== "all") list = list.filter((o) => o.customerId === customer);
    if (grade !== "all") list = list.filter((o) => o.grade === grade);
    if (status !== "all") list = list.filter((o) => o.status === status);
    return list;
  }, [orders.data, search, customer, grade, status]);

  if (orders.isLoading) return <LoadingState rows={6} />;
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

      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO number or customer" className="pl-9" />
        </div>
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {(customers.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
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
