import { appendHeader, assertMethod, getCookie, setResponseStatus } from "h3";
import { defineAuthenticatedEventHandler, getLogger } from "../main.js";
import throwError from "../middleware/error.js";
import { sendToServer } from "../utils/serverToServer.js";
import { AllValidTokensList, Cookies, parseResponseContentType, Results, safeAction } from "@internal/shared";

export default defineAuthenticatedEventHandler(async (event) => {
        const user = event.context.authorizedData;
        const log = getLogger().child({service: `auth-client`, branch: 'api_tokens_list_getter', reqId: event.context.rid });
        assertMethod(event, 'GET');

        if (!user) {
            throwError(log, event, 'AUTH_REQUIRED', 401, 'UnAuthorized', 'Un Authorized action', `
            Un Authorized action detected.`);
        }
    
        const userId = user.userId;
        if (!userId) {
            throwError(log, event, 'AUTH_CLIENT_ERROR', 400, 'Bad request', '', `
            Failed to get userId.`);
        }

       
            const canary = getCookie(event, 'canary_id');
            const accessToken = event.context.accessToken
            const refreshToken = event.context.session;

            if (!accessToken || !refreshToken || !canary) {
                throwError(log, event, 'AUTH_REQUIRED', 401, 'UnAuthorized', 'Un Authorized action', `
                Un Authorized action detected.`);
            }
    
            const cookies: Cookies[] = [
                { label: 'session', value: refreshToken  },
                { label: 'canary_id', value: canary }
            ];


            const getMeta = await safeAction(`${refreshToken}:${canary}:metadata-list-public`, async () => {
                return await sendToServer(false, '/api/manage/list-metadata', 'GET', event, false, cookies, undefined, accessToken)
            })

            if (!getMeta) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

            if (getMeta.status === 429) {
                const retrySec = getMeta.headers.get('Retry-After');
                appendHeader(event, 'Retry-After', Number(retrySec));
                throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
            }

            const parsedMetaRes = await parseResponseContentType(log, getMeta) as Results<AllValidTokensList>;

            if (getMeta.status !== 200 && !parsedMetaRes.ok || !parsedMetaRes.ok) {
                    setResponseStatus(event, getMeta.status)
                    return {
                        ok: false,
                        date: parsedMetaRes.date,
                        reason: parsedMetaRes.reason
                    }
            }

            // filter out pubKey handled by the server in `defineApiManagementHandler`, public client does not need it.
            const cleanedDataWithoutPubKey = {
                ...parsedMetaRes.data,
                tokenList: parsedMetaRes.data.tokenList?.map(({ public_identifier, ...rest }) => rest)
            }

            setResponseStatus(event, getMeta.status)
            return {
                ok: parsedMetaRes.ok,
                date: parsedMetaRes.date,
                data: cleanedDataWithoutPubKey 
            }
})