export interface Success<T>  {
    ok: true,
    date: string,
    data: T
}
export interface ApiError  {
    ok: false,
    date: string,
    reason: string,
}

export type Results<T = unknown> = Success<T> | ApiError;
