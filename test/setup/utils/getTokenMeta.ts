import { getApiListsController, Results } from "auth-h3client/v2";
import { createMockEvent } from "./cookieJar.js";
import { TestUser } from "./createTestUsers.js";
import { parseCookies } from "./parseRawCookies.js";

export interface Meta {
    tokenList: {
        id: number;
        name: string;
        created_at: string;
        expires_at: string;
        restricted_to_ip_address: string[] | null;
        last_used: string;
        usage_count: number;
        privilege_type: "custom" | "demo" | "restricted" | "protected" | "full";
    }[] | undefined;
    total: number;
    totalInvalidTokens: number;
    totalValidTokens: number;
} 

export async function getTokenMetaData(user: TestUser) {
    const serverCookies = parseCookies(user.serverCookies);

    const event = createMockEvent({
        cookies: {
            "__Secure-a": user.accessToken,
            "canary_id": user.canary, 
            "session": serverCookies["session"],
        }
    })

    const response = await getApiListsController(event);
    if (!response) throw new Error('Error getting metadata', response)
    return response as unknown as Results<Meta>
}