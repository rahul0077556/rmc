import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/auth/auth-context";
import { cum, dt } from "@/lib/format";

export const Route = createFileRoute("/_shell/sales/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · RMC Command Center" },
      { name: "description", content: "Review submitted purchase orders and release them to dispatch." },
      { property: "og:title", content: "Approvals · RMC Command Center" },
      { property: "og:description", content: "Review submitted purchase orders and release them to dispatch." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [approveTarget, setApproveTarget] = useState<OrderRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<OrderRow | null>(null);
  const [reason, setReason] = useState("");

  const queue = useQuery({ queryKey: ["approvals"], queryFn: () => ordersApi.approvalQueue().then((r) => r.data) });

  const approve = useMutation({
    mutationFn: (id: string) => ordersApi.approve(id, user?.name ?? "Sales Manager"),
    onSuccess: () => {
      toast.success("PO approved and sent to Dispatch");
      setApproveTarget(null);
      void qc.invalidateQueries();
    },
  });

  const reject = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      ordersApi.reject(input.id, input.reason, user?.name ?? "Sales Manager"),
    onSuccess: () => {
      toast.success("PO rejected");
      setRejectTarget(null);
      setReason("");
      void qc.invalidateQueries();
    },
  });

  if (queue.isLoading) return <LoadingState rows={5} />;
  if (queue.error || !queue.data) return <ErrorState message="The approval queue could not be loaded." onRetry={() => void queue.refetch()} />;

  const columns: Column<OrderRow>[] = [
    { key: "po", header: "PO Number", cell: (r) => <span className="font-medium">{r.poNumber}</span> },
    { key: "customer", header: "Customer", cell: (r) => r.customerName },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity), sortValue: (r) => r.quantity },
    { key: "date", header: "Delivery Date", cell: (r) => `${r.deliveryDate} ${r.deliveryTime}` },
    { key: "by", header: "Created By", cell: (r) => r.createdBy },
    { key: "at", header: "Submitted", cell: (r) => (r.submittedAt ? dt(r.submittedAt) : "—") },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setRejectTarget(r)}>
            Reject
          </Button>
          <Button size="sm" onClick={() => setApproveTarget(r)}>
            Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Approval Queue" subtitle="Submitted orders awaiting sales manager sign-off" />

      <DataTable
        columns={columns}
        rows={queue.data}
        rowKey={(r) => r.id}
        emptyTitle="Nothing to approve"
        emptyDescription="Submitted purchase orders will appear here for review."
      />

      <AlertDialog open={approveTarget !== null} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {approveTarget?.poNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget?.customerName} · {approveTarget?.grade} · {approveTarget && cum(approveTarget.quantity)}. The
              order moves to dispatch planning immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveTarget && approve.mutate(approveTarget.id)}>Approve order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.poNumber}</DialogTitle>
            <DialogDescription>Explain what needs to change before this order can be approved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason / remarks</Label>
            <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => rejectTarget && reject.mutate({ id: rejectTarget.id, reason })}
            >
              Reject order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
