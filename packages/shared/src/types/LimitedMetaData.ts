export interface LimitedMetaData {
    authorized: true,
    ipAddress: string,
    userAgent:  string,
    date: string,
    roles: string[] | "No roles added with this token.",
    userId: number | string,
    visitorId: number | string,
    accessToken: string, 
    accessIat: string
}