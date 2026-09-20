import mongoose from "mongoose";

type LimitOptions = {
    defaultLimit: number;
    maxLimit: number;
    minLimit?: number;
};

export type PageInfo = {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
    count: number;
};

export function parsePagination(searchParams: URLSearchParams, options: LimitOptions) {
    const minLimit = options.minLimit ?? 1;
    const rawLimit = Number(searchParams.get("limit") || options.defaultLimit);
    const limit = Math.min(
        options.maxLimit,
        Math.max(minLimit, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : options.defaultLimit)
    );

    const rawCursor = searchParams.get("cursor");
    const cursor = rawCursor && mongoose.Types.ObjectId.isValid(rawCursor)
        ? new mongoose.Types.ObjectId(rawCursor)
        : null;

    return {
        limit,
        cursor,
        cursorId: cursor?.toString() ?? null,
        invalidCursor: !!rawCursor && !cursor,
    };
}

export function paginateSlice<T>(
    items: T[],
    limit: number,
    getCursor: (item: T) => string | null | undefined
) {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && data.length > 0
        ? getCursor(data[data.length - 1]) || null
        : null;

    const pageInfo: PageInfo = {
        nextCursor,
        hasMore,
        limit,
        count: data.length,
    };

    return { data, nextCursor, pageInfo };
}

export function pageResponse<T extends Record<string, unknown>>(
    payload: T,
    pageInfo: PageInfo,
    init?: ResponseInit
) {
    return Response.json(
        {
            ...payload,
            nextCursor: pageInfo.nextCursor,
            pageInfo,
        },
        init
    );
}
