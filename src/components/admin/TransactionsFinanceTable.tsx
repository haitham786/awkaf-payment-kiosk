import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "completed" | "failed" | "pending";
type DateFilter = "today" | "yesterday" | "7days" | "30days" | "all";
type SortColumn = "created_at" | "amount_baisas" | "status";
type SortDirection = "asc" | "desc";

interface Transaction {
  id: string;
  amount_baisas: number;
  card_last_four: string | null;
  category: string;
  category_reference: string | null;
  completed_at: string | null;
  created_at: string;
  kiosk_id: string | null;
  mobile_number: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  pos_auth_code: string | null;
  pos_mid: string | null;
  pos_rrn: string | null;
  pos_tid: string | null;
  receipt_printed: boolean | null;
  receipt_sent: boolean | null;
  reference_number: string | null;
  sms_status: string | null;
  status: string;
  whatsapp_status: string | null;
  kiosks?: { name: string; location?: string | null; reference_number?: string | null } | null;
}

interface Kiosk {
  id: string;
  name: string;
  reference_number?: string | null;
}

interface Category {
  category_reference: string | null;
  category_id: string;
  title: string;
  title_en: string | null;
}

interface TransactionsFinanceTableProps {
  transactions: Transaction[];
  kiosks: Kiosk[];
  isSuperAdmin: boolean;
}

const MUSCAT_TIME_ZONE = "Asia/Muscat";

const muscatDateKey = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MUSCAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const shiftDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

const formatGroupDate = (dateKey: string) => {
  const today = muscatDateKey(new Date());
  const yesterday = shiftDateKey(today, -1);
  const date = new Date(`${dateKey}T12:00:00Z`);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date).toUpperCase();
  if (dateKey === today) return `TODAY · ${formatted}`;
  if (dateKey === yesterday) return `YESTERDAY · ${formatted}`;
  return formatted;
};

const formatMuscatDate = (value: string) => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: MUSCAT_TIME_ZONE,
}).format(new Date(value));

const formatMuscatTime = (value: string) => new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: MUSCAT_TIME_ZONE,
}).format(new Date(value));

const formatAmount = (baisas: number) => (baisas / 1000).toFixed(3);
const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusMeta = (status: string) => {
  if (status === "completed") return { label: "Completed", className: "bg-success/10 text-success" };
  if (status === "failed") return { label: "Failed", className: "bg-destructive/10 text-destructive" };
  if (status === "pending" || status === "processing") return { label: status === "processing" ? "Processing" : "Pending", className: "bg-warning/15 text-warning" };
  return { label: titleCase(status), className: "bg-muted text-muted-foreground" };
};

const maskMobile = (mobile: string | null, canView: boolean) => {
  if (!mobile) return "—";
  if (canView) return mobile;
  return `${"•".repeat(Math.max(0, mobile.length - 3))}${mobile.slice(-3)}`;
};

const StatusPill = ({ status }: { status: string }) => {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", meta.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
    </span>
  );
};

const TransactionsFinanceTable = ({ transactions, kiosks, isSuperAdmin }: TransactionsFinanceTableProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [kioskFilter, setKioskFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("donation_categories")
      .select("category_reference, category_id, title, title_en")
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        if (active) setCategories((data || []) as Category[]);
      });
    return () => { active = false; };
  }, []);

  const categoryMap = useMemo(() => new Map(
    categories.flatMap((category) => {
      const entries: [string, Category][] = [];
      if (category.category_reference) entries.push([category.category_reference.toLowerCase(), category]);
      if (category.category_id) entries.push([category.category_id.toLowerCase(), category]);
      return entries;
    }),
  ), [categories]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const today = muscatDateKey(new Date());
    const yesterday = shiftDateKey(today, -1);
    const dateStart = dateFilter === "7days" ? shiftDateKey(today, -6) : dateFilter === "30days" ? shiftDateKey(today, -29) : null;

    const filtered = transactions.filter((transaction) => {
      const categoryKey = transaction.category_reference?.toLowerCase();
      const category = categoryKey ? categoryMap.get(categoryKey) : undefined;
      const transactionDate = muscatDateKey(transaction.created_at);
      const matchesDate = dateFilter === "all"
        || (dateFilter === "today" && transactionDate === today)
        || (dateFilter === "yesterday" && transactionDate === yesterday)
        || ((dateFilter === "7days" || dateFilter === "30days") && dateStart !== null && transactionDate >= dateStart && transactionDate <= today);
      const matchesStatus = statusFilter === "all"
        || transaction.status === statusFilter
        || (statusFilter === "pending" && transaction.status === "processing");
      const matchesSearch = !normalizedSearch || [
        transaction.reference_number,
        transaction.payment_reference,
        transaction.pos_rrn,
        transaction.category_reference,
        transaction.category,
        category?.title,
        category?.title_en,
        transaction.mobile_number,
        transaction.kiosks?.name,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));

      return matchesDate
        && matchesStatus
        && (kioskFilter === "all" || transaction.kiosk_id === kioskFilter)
        && (categoryFilter === "all" || transaction.category_reference === categoryFilter)
        && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const statusOrder: Record<string, number> = { completed: 1, pending: 2, processing: 3, failed: 4, cancelled: 5, refunded: 6, reversed: 7 };
      const aValue = sortColumn === "created_at" ? new Date(a.created_at).getTime() : sortColumn === "amount_baisas" ? a.amount_baisas : statusOrder[a.status] || 99;
      const bValue = sortColumn === "created_at" ? new Date(b.created_at).getTime() : sortColumn === "amount_baisas" ? b.amount_baisas : statusOrder[b.status] || 99;
      return (aValue - bValue) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [transactions, search, statusFilter, dateFilter, kioskFilter, categoryFilter, sortColumn, sortDirection, categoryMap]);

  useEffect(() => { setPage(1); }, [search, statusFilter, dateFilter, kioskFilter, categoryFilter, rowsPerPage]);

  const completed = filteredTransactions.filter((transaction) => transaction.status === "completed");
  const completedTotal = completed.reduce((sum, transaction) => sum + transaction.amount_baisas, 0);
  const failedCount = filteredTransactions.filter((transaction) => transaction.status === "failed").length;
  const pendingCount = filteredTransactions.filter((transaction) => transaction.status === "pending" || transaction.status === "processing").length;
  const decidedCount = completed.length + failedCount;
  const successRate = decidedCount > 0 ? (completed.length / decidedCount) * 100 : 0;
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const firstRow = filteredTransactions.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const lastRow = Math.min(safePage * rowsPerPage, filteredTransactions.length);
  const paginatedTransactions = filteredTransactions.slice(firstRow === 0 ? 0 : firstRow - 1, lastRow);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFilter("today");
    setKioskFilter("all");
    setCategoryFilter("all");
  };

  const changeSort = (column: SortColumn) => {
    if (sortColumn === column) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortColumn(column);
      setSortDirection(column === "created_at" ? "desc" : "asc");
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const pageNumbers = Array.from({ length: Math.min(3, totalPages) }, (_, index) => {
    if (totalPages <= 3 || safePage <= 2) return index + 1;
    if (safePage >= totalPages - 1) return totalPages - 2 + index;
    return safePage - 1 + index;
  });

  const receiptLabel = (transaction: Transaction) => {
    if (transaction.sms_status === "sent") return `SMS sent · ${maskMobile(transaction.mobile_number, isSuperAdmin)}`;
    if (transaction.whatsapp_status === "sent") return `WhatsApp sent · ${maskMobile(transaction.mobile_number, isSuperAdmin)}`;
    if (transaction.receipt_printed) return "Printed";
    if (transaction.receipt_sent) return "Sent";
    return "Not sent";
  };

  const getCategory = (transaction: Transaction) => {
    const key = transaction.category_reference?.toLowerCase();
    return key ? categoryMap.get(key) : undefined;
  };

  return (
    <>
      <Card className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="border-b px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-foreground">Transactions</h3>
              <p className="mt-1 text-xs text-muted-foreground">{filteredTransactions.length} results · settled &amp; attempts · Muscat time (GST)</p>
            </div>
            <Button variant="link" size="sm" className="h-auto self-start px-0 text-primary" onClick={resetFilters}>Clear filters</Button>
          </div>
        </div>

        <div className="sticky top-0 z-20 border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="grid gap-2 xl:grid-cols-[minmax(240px,1fr)_auto_144px_170px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, POS/Bank RRN, category or mobile…" className="h-10 pl-9 text-foreground" />
            </div>
            <div className="flex h-10 overflow-hidden rounded-md border bg-background" aria-label="Filter by status">
              {(["all", "completed", "failed", "pending"] as StatusFilter[]).map((status) => (
                <Button key={status} type="button" variant="ghost" size="sm" onClick={() => setStatusFilter(status)} className={cn("h-full rounded-none border-r px-3 capitalize text-foreground last:border-r-0 hover:bg-muted", statusFilter === status && "bg-primary/10 text-primary hover:bg-primary/10")}>
                  {status}
                </Button>
              ))}
            </div>
            <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
              <SelectTrigger className="h-10 text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem><SelectItem value="7days">Last 7 days</SelectItem><SelectItem value="30days">Last 30 days</SelectItem><SelectItem value="all">All time</SelectItem></SelectContent>
            </Select>
            <Select value={kioskFilter} onValueChange={setKioskFilter}>
              <SelectTrigger className="h-10 text-foreground"><SelectValue placeholder="All kiosks" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All kiosks</SelectItem>{kiosks.map((kiosk) => <SelectItem key={kiosk.id} value={kiosk.id}>{kiosk.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 text-foreground"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.filter((category) => category.category_reference).map((category) => <SelectItem key={category.category_reference} value={category.category_reference || ""}>{category.title_en || category.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b bg-muted p-4 sm:grid-cols-3 lg:grid-cols-5 sm:px-6">
          <div className="rounded-lg border bg-background px-3 py-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Showing</p><p className="mt-1 text-xl font-bold tabular-nums">{filteredTransactions.length}</p></div>
          <div className="rounded-lg border bg-background px-3 py-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Completed</p><p className="mt-1 font-mono text-lg font-bold text-success">{completed.length} <span className="text-xs text-muted-foreground">· {formatAmount(completedTotal)} OMR</span></p></div>
          <div className="rounded-lg border bg-background px-3 py-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Failed</p><p className="mt-1 text-xl font-bold tabular-nums text-destructive">{failedCount}</p></div>
          <div className="rounded-lg border bg-background px-3 py-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Pending</p><p className="mt-1 text-xl font-bold tabular-nums text-warning">{pendingCount}</p></div>
          <div className="rounded-lg border bg-background px-3 py-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Success rate</p><p className="mt-1 text-xl font-bold tabular-nums">{successRate.toFixed(1)}<span className="text-sm text-muted-foreground">%</span></p></div>
        </div>

        <div className="max-h-[620px] overflow-auto">
          <Table className="min-w-[860px]">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_hsl(var(--border))]">
              <TableRow className="hover:bg-muted">
                <TableHead className="h-10 px-4 text-[11px] font-bold uppercase"><Button variant="ghost" size="sm" className="h-8 px-0 text-[11px] font-bold uppercase text-muted-foreground hover:bg-transparent" onClick={() => changeSort("created_at")}>Date &amp; Time <SortIcon column="created_at" /></Button></TableHead>
                <TableHead className="h-10 px-4 text-[11px] font-bold uppercase">Reference</TableHead>
                <TableHead className="h-10 px-4 text-[11px] font-bold uppercase">Kiosk</TableHead>
                <TableHead className="h-10 px-4 text-[11px] font-bold uppercase">Category</TableHead>
                <TableHead className="h-10 px-4 text-right text-[11px] font-bold uppercase"><Button variant="ghost" size="sm" className="ml-auto h-8 px-0 text-[11px] font-bold uppercase text-muted-foreground hover:bg-transparent" onClick={() => changeSort("amount_baisas")}>Amount <SortIcon column="amount_baisas" /></Button></TableHead>
                <TableHead className="h-10 px-4 text-[11px] font-bold uppercase"><Button variant="ghost" size="sm" className="h-8 px-0 text-[11px] font-bold uppercase text-muted-foreground hover:bg-transparent" onClick={() => changeSort("status")}>Status <SortIcon column="status" /></Button></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No transactions match these filters.</TableCell></TableRow>
              ) : paginatedTransactions.map((transaction, index) => {
                const category = getCategory(transaction);
                const currentGroup = muscatDateKey(transaction.created_at);
                const previousGroup = index > 0 ? muscatDateKey(paginatedTransactions[index - 1].created_at) : null;
                return [
                  currentGroup !== previousGroup ? (
                    <TableRow key={`group-${currentGroup}`} className="bg-muted/70 hover:bg-muted/70"><TableCell colSpan={6} className="h-7 px-4 py-1 text-[10px] font-bold uppercase tracking-normal text-muted-foreground">{formatGroupDate(currentGroup)}</TableCell></TableRow>
                  ) : null,
                  <TableRow key={transaction.id} tabIndex={0} role="button" onClick={() => setSelectedTransaction(transaction)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedTransaction(transaction); }} className={cn("cursor-pointer odd:bg-muted/20 hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none", index % 2 === 1 && "bg-muted/30")}>
                    <TableCell className="h-12 px-4 py-1.5"><div className="text-xs font-semibold">{formatMuscatTime(transaction.created_at)}</div><div className="text-[10px] text-muted-foreground">{formatMuscatDate(transaction.created_at)}</div></TableCell>
                    <TableCell className="h-12 px-4 py-1.5 font-mono text-xs">{transaction.reference_number || transaction.payment_reference || "—"}</TableCell>
                    <TableCell className="h-12 px-4 py-1.5">{transaction.kiosks?.name ? <span className="inline-flex rounded-md border bg-muted px-2 py-1 text-xs font-semibold">{transaction.kiosks.name}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="h-12 px-4 py-1.5"><div className="text-xs font-semibold">{category?.title_en || category?.title || titleCase(transaction.category)}</div><div className="font-mono text-[10px] text-muted-foreground">{transaction.category_reference || category?.category_id || "—"}</div></TableCell>
                    <TableCell className="h-12 px-4 py-1.5 text-right font-mono text-sm font-bold tabular-nums">{formatAmount(transaction.amount_baisas)} <span className="text-[10px] text-muted-foreground">OMR</span></TableCell>
                    <TableCell className="h-12 px-4 py-1.5"><StatusPill status={transaction.status} /></TableCell>
                  </TableRow>,
                ];
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Showing {firstRow}–{lastRow} of {filteredTransactions.length}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}><SelectTrigger className="h-8 w-20 text-foreground"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
            <Button variant="outline" size="sm" className="h-8 px-2 text-foreground" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            {pageNumbers.map((pageNumber) => <Button key={pageNumber} variant={safePage === pageNumber ? "secondary" : "outline"} size="icon" className={cn("h-8 w-8 text-foreground", safePage === pageNumber && "bg-primary/10 text-primary")} onClick={() => setPage(pageNumber)}>{pageNumber}</Button>)}
            <Button variant="outline" size="sm" className="h-8 px-2 text-foreground" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      <Sheet open={selectedTransaction !== null} onOpenChange={(open) => { if (!open) setSelectedTransaction(null); }}>
        <SheetContent className="transactions-finance w-full overflow-y-auto border-l bg-background p-0 text-foreground sm:max-w-md">
          {selectedTransaction && (() => {
            const category = getCategory(selectedTransaction);
            const details = [
              ["Date & time", `${formatMuscatDate(selectedTransaction.created_at)} · ${formatMuscatTime(selectedTransaction.created_at)} GST`],
              ["System reference", selectedTransaction.reference_number || selectedTransaction.payment_reference || "—"],
              ["POS / Bank RRN", selectedTransaction.pos_rrn || "—"],
              ["Auth code", selectedTransaction.pos_auth_code || "—"],
              ["TID · MID", `${selectedTransaction.pos_tid || "—"} · ${selectedTransaction.pos_mid || "—"}`],
              ["Category", `${category?.title_en || category?.title || titleCase(selectedTransaction.category)} · ${selectedTransaction.category_reference || category?.category_id || "—"}`],
              ["Kiosk", selectedTransaction.kiosks?.name || "— (online)"],
              ["Method · card", `${selectedTransaction.payment_method ? titleCase(selectedTransaction.payment_method) : "—"} · ${selectedTransaction.card_last_four ? `••••${isSuperAdmin ? selectedTransaction.card_last_four : selectedTransaction.card_last_four.slice(-2).padStart(4, "•")}` : "—"}`],
              ["Receipt", receiptLabel(selectedTransaction)],
              ["Completed at", selectedTransaction.completed_at ? `${formatMuscatDate(selectedTransaction.completed_at)} · ${formatMuscatTime(selectedTransaction.completed_at)} GST` : "—"],
            ];
            return <>
              <SheetHeader className="border-b px-6 py-5 text-left"><div className="pr-8"><SheetTitle>Transaction detail</SheetTitle><SheetDescription>Reconciliation and payment enquiry details</SheetDescription></div><div className="pt-2"><StatusPill status={selectedTransaction.status} /></div></SheetHeader>
              <div className="px-6 py-8"><div className="mb-8 text-center font-mono text-3xl font-bold tabular-nums">{formatAmount(selectedTransaction.amount_baisas)} <span className="text-sm text-muted-foreground">OMR</span></div><dl>{details.map(([label, value]) => <div key={label} className="grid grid-cols-[128px_1fr] gap-4 border-b py-3 text-sm last:border-b-0"><dt className="text-muted-foreground">{label}</dt><dd className={cn("break-words text-right font-semibold", ["System reference", "POS / Bank RRN", "Auth code", "TID · MID"].includes(label) && "font-mono")}>{value}</dd></div>)}</dl></div>
            </>;
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default TransactionsFinanceTable;