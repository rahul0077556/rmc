import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export interface ListQueryParams {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
  [key: string]: any;
}

export function useListQuery<TData>(
  baseQueryKey: string[],
  queryFn: (params: ListQueryParams) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error, TData, any>, "queryKey" | "queryFn">
) {
  const search = useSearch({ strict: false }) as ListQueryParams;
  const navigate = useNavigate();

  const params: ListQueryParams = {
    q: search.q || "",
    page: Number(search.page) || 1,
    page_size: Number(search.page_size) || 10,
    from: search.from,
    to: search.to,
    status: search.status,
    sort: search.sort,
    order: search.order,
  };

  const updateParams = (newParams: Partial<ListQueryParams>) => {
    void navigate({
      search: ((prev: any) => {
        const updated = { ...prev, ...newParams };
        // Clean up empty params
        Object.keys(updated).forEach((key) => {
          if (updated[key] === "" || updated[key] === undefined || updated[key] === null) {
            delete updated[key];
          }
        });
        if (newParams.q !== undefined && newParams.q !== prev.q) {
          updated.page = 1; // reset page on search
        }
        return updated;
      }) as any,
      replace: true,
    });
  };

  const query = useQuery({
    queryKey: [...baseQueryKey, params],
    queryFn: () => queryFn(params),
    ...options,
  });

  return {
    params,
    updateParams,
    query,
  };
}
