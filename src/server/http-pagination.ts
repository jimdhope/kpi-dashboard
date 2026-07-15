export function pageParams(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const defaultLimit = options.defaultLimit ?? 100;
  const maxLimit = options.maxLimit ?? 500;
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(maxLimit, Math.max(1, parsedLimit))
    : defaultLimit;
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;
  return { limit, offset, take: limit + 1 };
}

export function pagedResult<T>(items: T[], limit: number, offset: number) {
  const hasMore = items.length > limit;
  return {
    items: hasMore ? items.slice(0, limit) : items,
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  };
}
