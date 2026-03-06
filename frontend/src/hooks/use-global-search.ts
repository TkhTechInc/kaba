import { useCallback, useEffect, useRef, useState } from "react";
import { createInvoicesApi } from "@/services/invoices.service";
import { createProductsApi } from "@/services/products.service";
import { createDebtsApi } from "@/services/debts.service";

export type SearchResultKind = "invoice" | "customer" | "product" | "debt";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  kind: SearchResultKind;
  label: string;
  results: SearchResult[];
}

interface CacheEntry {
  customers: Awaited<ReturnType<ReturnType<typeof createInvoicesApi>["listCustomers"]>>["data"]["items"];
  invoices: Awaited<ReturnType<ReturnType<typeof createInvoicesApi>["list"]>>["data"]["items"];
  products: Awaited<ReturnType<ReturnType<typeof createProductsApi>["list"]>>["data"]["items"];
  debts: Awaited<ReturnType<ReturnType<typeof createDebtsApi>["list"]>>["data"]["items"];
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;

export function useGlobalSearch(token: string | null, businessId: string | null) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // In-memory data cache — avoids refetching on every keystroke
  const dataCache = useRef<CacheEntry | null>(null);
  const fetchingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (): Promise<CacheEntry | null> => {
    if (!token || !businessId) return null;
    if (dataCache.current) return dataCache.current;
    if (fetchingRef.current) return null;

    fetchingRef.current = true;
    try {
      const invoicesApi = createInvoicesApi(token);
      const productsApi = createProductsApi(token);
      const debtsApi = createDebtsApi(token);

      const [invoicesRes, customersRes, productsRes, debtsRes] = await Promise.allSettled([
        invoicesApi.list(businessId, 1, 50),
        invoicesApi.listCustomers(businessId, 1, 200),
        productsApi.list(businessId, 1, 200),
        debtsApi.list(businessId, 1, 50),
      ]);

      const entry: CacheEntry = {
        invoices: invoicesRes.status === "fulfilled" ? invoicesRes.value.data.items : [],
        customers: customersRes.status === "fulfilled" ? customersRes.value.data.items : [],
        products: productsRes.status === "fulfilled" ? productsRes.value.data.items : [],
        debts: debtsRes.status === "fulfilled" ? debtsRes.value.data.items : [],
      };

      dataCache.current = entry;
      return entry;
    } finally {
      fetchingRef.current = false;
    }
  }, [token, businessId]);

  // Invalidate cache when business changes
  useEffect(() => {
    dataCache.current = null;
  }, [businessId]);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim().toLowerCase();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setGroups([]);
        setOpen(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await fetchData();
      setLoading(false);

      if (!data) return;

      const customerMatches: SearchResult[] = data.customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(trimmed) ||
            (c.email ?? "").toLowerCase().includes(trimmed) ||
            (c.phone ?? "").toLowerCase().includes(trimmed)
        )
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          kind: "customer" as const,
          title: c.name,
          subtitle: c.email ?? c.phone ?? "",
          href: `/customers`,
        }));

      // For invoices, join with customer name
      const customerMap = new Map(data.customers.map((c) => [c.id, c.name]));
      const invoiceMatches: SearchResult[] = data.invoices
        .filter((inv) => {
          const cName = (customerMap.get(inv.customerId) ?? "").toLowerCase();
          return (
            cName.includes(trimmed) ||
            inv.id.toLowerCase().includes(trimmed) ||
            inv.status.toLowerCase().includes(trimmed) ||
            String(inv.amount).includes(trimmed)
          );
        })
        .slice(0, 5)
        .map((inv) => ({
          id: inv.id,
          kind: "invoice" as const,
          title: customerMap.get(inv.customerId) ?? inv.id.slice(0, 8),
          subtitle: `${inv.currency} ${inv.amount.toLocaleString()} · ${inv.status}`,
          href: `/invoices/${inv.id}/edit`,
        }));

      const productMatches: SearchResult[] = data.products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(trimmed) ||
            (p.brand ?? "").toLowerCase().includes(trimmed)
        )
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          kind: "product" as const,
          title: p.name,
          subtitle: p.brand ? `${p.brand} · ${p.currency} ${p.unitPrice.toLocaleString()}` : `${p.currency} ${p.unitPrice.toLocaleString()}`,
          href: `/products`,
        }));

      const debtMatches: SearchResult[] = data.debts
        .filter(
          (d) =>
            d.debtorName.toLowerCase().includes(trimmed) ||
            (d.notes ?? "").toLowerCase().includes(trimmed) ||
            d.status.toLowerCase().includes(trimmed)
        )
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          kind: "debt" as const,
          title: d.debtorName,
          subtitle: `${d.currency} ${d.amount.toLocaleString()} · ${d.status}`,
          href: `/debts`,
        }));

      const newGroups: SearchGroup[] = [
        { kind: "invoice", label: "Invoices", results: invoiceMatches },
        { kind: "customer", label: "Customers", results: customerMatches },
        { kind: "product", label: "Products", results: productMatches },
        { kind: "debt", label: "Debts", results: debtMatches },
      ].filter((g) => g.results.length > 0);

      setGroups(newGroups);
      setOpen(newGroups.length > 0 || trimmed.length >= MIN_QUERY_LENGTH);
    },
    [fetchData]
  );

  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < MIN_QUERY_LENGTH) {
        setGroups([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    },
    [runSearch]
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroups([]);
  }, []);

  // Prefetch data when the user focuses the search box
  const prefetch = useCallback(() => {
    if (!dataCache.current) fetchData();
  }, [fetchData]);

  const totalResults = groups.reduce((n, g) => n + g.results.length, 0);

  return { query, handleQueryChange, groups, loading, open, close, prefetch, totalResults };
}
