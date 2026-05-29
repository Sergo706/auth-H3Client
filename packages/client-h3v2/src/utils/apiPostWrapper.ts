import { defineHandler, EventHandler, EventHandlerRequest, getCookie } from "h3";
import { defineAuthenticatedEventPostHandlers } from "./authenticatedPostHandler.js";
import { Cookies, CreationSuccess, getLogger, newApiTokenSchema, parseResponseContentType, privilegeQ, reqParams, Results, safeAction, validateZodSchema, ipRestrictionUpdate, AllValidTokensList, ActionManagerResult, tokenId, InternalUnion, ApiTokenRotationSuccess, SingleTokenMeta } from "@internal/shared";
import z from "zod";
import throwError from "../middleware/error.js";
import { sendToServer } from "./serverToServer.js";
import { defineByteLimiterHandler } from "./limitBytesWrapper.js";

export type Privilege = z.infer<typeof privilegeQ>
export type ParamsTypes = z.infer<typeof reqParams>
export type NewTokens = z.infer<typeof newApiTokenSchema>
export type NewIpRestriction = z.infer<typeof ipRestrictionUpdate>
export type TokenId = z.infer<typeof tokenId>

export const defineApiManagementHandler = <T extends EventHandlerRequest, D>(
  handler: EventHandler<T, D>,
  allowedPrivilege: Privilege,
  updateToNewPrivilege?: Privilege,
):  EventHandler<T, Promise<D>> => {

return defineByteLimiterHandler(
   defineAuthenticatedEventPostHandlers(
     defineHandler(async (event) => {
        const user = event.context.authorizedData;
        const log = getLogger().child({service: `auth-client`, branch: 'api_tokens_actions', reqId: event.context.rid });

        if (!user) {
            throwError(log, event, 'AUTH_REQUIRED', 401, 'UnAuthorized', 'Un Authorized action', `
            Un Authorized action detected.`);
        }
        
        const userId = user.userId;
        if (!userId) {
            throwError(log, event, 'AUTH_CLIENT_ERROR', 400, 'Bad request', '', `
            Failed to get userId.`);
        }

            const action = event.context.params as ParamsTypes;
            const validation = validateZodSchema(reqParams, action, log);
        
             if ('valid' in validation) {
                 log.error({...validation.errors}, 'Validation failed');
                 throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid route params`);
              }

            const { action: validatedAction } = validation.data;
       
            const canary = getCookie(event, 'canary_id');
            const accessToken = event.context.accessToken
            const refreshToken = event.context.session;
              
            if (!accessToken || !refreshToken || !canary) {
                throwError(log, event, 'AUTH_REQUIRED', 401, 'UnAuthorized', 'Un Authorized action', `
                Un Authorized action detected.`);
            }

            if (validatedAction === 'list-metadata') {
                throwError(log, event, 'AUTH_CLIENT_ERROR', 400, 'Bad request', '', `
                list-metadata is only for get requests.`);
            }

            
            const cookies: Cookies[] = [
                { label: 'session', value: refreshToken  },
                { label: 'canary_id', value: canary }
            ];

            if (validatedAction === 'new-token') {
               const body = event.context.body as NewTokens;
               const validation = validateZodSchema(newApiTokenSchema, body, log);
                
               if ('valid' in validation) {
                  log.error({...validation.errors}, 'Validation failed');
                  throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid body for new-token`);
               }
               
            // privileges should be controlled by the app business logic not consumers. depending on what is 'plan' and what plan a user sub to
               const validatedBody = {
                  ...validation.data,
                  privilege: allowedPrivilege
               };

               // deduplicate
               const res = await safeAction(`${refreshToken}:${canary}:newToken`, async () => {
                   return await sendToServer(false, '/api/manage/new-token', 'POST', event, true, cookies, validatedBody, accessToken)
               })
    
               if (!res) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);
               
               if (res.status === 429) {
                   const retrySec = res.headers.get('Retry-After');
                   event.res.headers.append("Retry-After", String(retrySec))
                   throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
                }
                
                const parsedRes = await parseResponseContentType(log, res) as Results<CreationSuccess & { rawPublicId: string }>;

               if (res.status !== 201 && !parsedRes.ok || !parsedRes.ok) {
                    event.res.status = res.status;
                    return {
                        ok: false,
                        date: parsedRes.date,
                        reason: parsedRes.reason
                    }
               }
               
               const { rawPublicId, ...rest }= parsedRes.data
               event.context.newApiToken = rest;
               return handler(event);
            } 

            // let the bff handle the pub key

            const getMeta = await safeAction(`${refreshToken}:${canary}:metadata-list-internal`, async () => {
                return await sendToServer(false, '/api/manage/list-metadata', 'GET', event, false, cookies, undefined, accessToken)
            })

            if (!getMeta) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

            if (getMeta.status === 429) {
                const retrySec = getMeta.headers.get('Retry-After');
                event.res.headers.append("Retry-After", String(retrySec))
                throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
            }

            const parsedMetaRes = await parseResponseContentType(log, getMeta) as Results<AllValidTokensList>;

            if (getMeta.status !== 200 && !parsedMetaRes.ok || !parsedMetaRes.ok) {
                    event.res.status = getMeta.status;
                    return {
                        ok: false,
                        date: parsedMetaRes.date,
                        reason: parsedMetaRes.reason
                    }
            }


            if (validatedAction === 'ip-restriction-update') {
                  const body = event.context.body as NewIpRestriction;
                  const validation = validateZodSchema(ipRestrictionUpdate, body, log);

                 if ('valid' in validation) {
                    log.error({...validation.errors}, 'Validation failed');
                    throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid route params`);
               }

               const validatedData = validation.data;
               const token = parsedMetaRes.data.tokenList?.find(a => a.id === validatedData.tokenId);
               // log it
               if (!token) {
                    throwError(log,event, 'FORBIDDEN', 401, "Token doesn't exists", "", `
                        couldn't find the public identity \n
                        ${JSON.stringify(parsedMetaRes.data.tokenList)}
                        `);
               }

               const validatedBody = {
                    ...validatedData,
                    publicIdentifier: token.public_identifier,
                    name: token.name,
                    tokenId: token.id,
               };

                 // deduplicate
               const res = await safeAction(`${refreshToken}:${canary}:ip-restriction-update`, async () => {
                   return await sendToServer(false, '/api/manage/ip-restriction-update', 'POST', event, true, cookies, validatedBody, accessToken)
               })

               if (!res) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

               if (res.status === 429) {
                   const retrySec = res.headers.get('Retry-After');
                   event.res.headers.append("Retry-After", String(retrySec))
                   throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
                }

               const parsedRes = await parseResponseContentType(log, res) as ActionManagerResult;

               if (res.status !== 200 && !parsedRes.ok || !parsedRes.ok) {
                    event.res.status = res.status;
                    return {
                        ok: false,
                        date: parsedRes.date,
                        reason: parsedRes.reason
                    }
               }

               event.context.ipRestrictionUpdate = parsedRes.data as Extract<InternalUnion, { msg: string }>;
               return handler(event);
            }


            if (validatedAction === 'privilege-update') {

                if (!updateToNewPrivilege) {
                    event.res.status = 403;
                    return {
                        ok: false,
                        date: new Date().toISOString(),
                        reason: 'This action is forbidden'
                    }
                }
                
                const body = event.context.body as TokenId;
                const validation = validateZodSchema(tokenId, body, log);

                 if ('valid' in validation) {
                    log.error({...validation.errors}, 'Validation failed');
                    throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid route params`);
                }


               const validatedData = validation.data;
               const token = parsedMetaRes.data.tokenList?.find(a => a.id === validatedData.tokenId);

               if (!token) {
                    throwError(log,event, 'FORBIDDEN', 401, "Token doesn't exists", "", `
                        couldn't find the public identity \n
                        ${JSON.stringify(parsedMetaRes.data.tokenList)}
                        `);
               }

                // privileges should be controlled by the app business logic not consumers. depending on what is 'plan' and what 'plan' the user 'upgrades' to

                const validatedBody = {
                    newPrivilege: updateToNewPrivilege,
                    tokenId: token.id,
                    publicIdentifier: token.public_identifier,
                    name: token.name,
               };

                // deduplicate
               const res = await safeAction(`${refreshToken}:${canary}:privilege-update`, async () => {
                   return await sendToServer(false, '/api/manage/privilege-update', 'POST', event, true, cookies, validatedBody, accessToken)
               })

               if (!res) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

               if (res.status === 429) {
                   const retrySec = res.headers.get('Retry-After');
                   event.res.headers.append("Retry-After", String(retrySec))
                   throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
                }

               const parsedRes = await parseResponseContentType(log, res) as ActionManagerResult;

               if (res.status !== 200 && !parsedRes.ok || !parsedRes.ok) {
                    event.res.status = res.status;
                    return {
                        ok: false,
                        date: parsedRes.date,
                        reason: parsedRes.reason
                    }
               }

               event.context.privilegeUpdate = parsedRes.data as Extract<InternalUnion, { msg: string }>;
               return handler(event);

            }

            if (validatedAction === 'revoke') {
                const body = event.context.body as TokenId;
                const validation = validateZodSchema(tokenId, body, log);

                 if ('valid' in validation) {
                    log.error({...validation.errors}, 'Validation failed');
                    throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid route params`);
                }

               const validatedData = validation.data;
               const token = parsedMetaRes.data.tokenList?.find(a => a.id === validatedData.tokenId);

               if (!token) {
                    throwError(log,event, 'FORBIDDEN', 401, "Token doesn't exists", "", `
                        couldn't find the public identity \n
                        ${JSON.stringify(parsedMetaRes.data.tokenList)}
                        `);
               }

              const validatedBody = {
                    tokenId: token.id,
                    publicIdentifier: token.public_identifier,
                    name: token.name,
               };

               // deduplicate
               const res = await safeAction(`${refreshToken}:${canary}:revoke`, async () => {
                   return await sendToServer(false, '/api/manage/revoke', 'POST', event, true, cookies, validatedBody, accessToken)
               })

               if (!res) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

               if (res.status === 429) {
                   const retrySec = res.headers.get('Retry-After');
                   event.res.headers.append("Retry-After", String(retrySec))
                   throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
                }

               const parsedRes = await parseResponseContentType(log, res) as ActionManagerResult;

               if (res.status !== 200 && !parsedRes.ok || !parsedRes.ok) {
                    event.res.status = res.status;
                    return {
                        ok: false,
                        date: parsedRes.date,
                        reason: parsedRes.reason
                    }
               }


              event.context.revoke = parsedRes.data as Extract<InternalUnion, string | { msg: string; invalidedTokenId: number; userId: number }>;
               return handler(event);

            }

            if (validatedAction === 'metadata') {
                const body = event.context.body as TokenId;
                const validation = validateZodSchema(tokenId, body, log);

                 if ('valid' in validation) {
                    log.error({...validation.errors}, 'Validation failed');
                    throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid route params`);
                }

               const validatedData = validation.data;
               const token = parsedMetaRes.data.tokenList?.find(a => a.id === validatedData.tokenId);

               if (!token) {
                    throwError(log,event, 'FORBIDDEN', 401, "Token doesn't exists", "", `
                        couldn't find the public identity \n
                        ${JSON.stringify(parsedMetaRes.data.tokenList)}
                        `);
               }

              const validatedBody = {
                    tokenId: token.id,
                    publicIdentifier: token.public_identifier,
                    name: token.name,
               };

               // deduplicate
               const res = await safeAction(`${refreshToken}:${canary}:extensive-metadata`, async () => {
                   return await sendToServer(false, '/api/manage/metadata', 'POST', event, true, cookies, validatedBody, accessToken)
               })

               if (!res) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

               if (res.status === 429) {
                   const retrySec = res.headers.get('Retry-After');
                   event.res.headers.append("Retry-After", String(retrySec))
                   throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
                }

               const parsedRes = await parseResponseContentType(log, res) as ActionManagerResult;

               if (res.status !== 200 && !parsedRes.ok || !parsedRes.ok) {
                    event.res.status = res.status;
                    return {
                        ok: false,
                        date: parsedRes.date,
                        reason: parsedRes.reason
                    }
               }

               event.context.extensiveMetadata = parsedRes.data as Extract<InternalUnion, SingleTokenMeta>;
               return handler(event);

            }

            if (validatedAction === 'rotate') {
                const body = event.context.body as TokenId;
                const validation = validateZodSchema(tokenId, body, log);

                 if ('valid' in validation) {
                    log.error({...validation.errors}, 'Validation failed');
                    throwError(log,event, 'NOT_FOUND', 404, "Not found", "This Page doesn't exists.", `Invalid route params`);
                }

               const validatedData = validation.data;
               const token = parsedMetaRes.data.tokenList?.find(a => a.id === validatedData.tokenId);

               if (!token) {
                    throwError(log,event, 'FORBIDDEN', 401, "Token doesn't exists", "", `
                        couldn't find the public identity \n
                        ${JSON.stringify(parsedMetaRes.data.tokenList)}
                        `);
               }

              const validatedBody = {
                    tokenId: token.id,
                    publicIdentifier: token.public_identifier,
                    name: token.name,
               };

               // deduplicate
               const res = await safeAction(`${refreshToken}:${canary}:rotate`, async () => {
                   return await sendToServer(false, '/api/manage/rotate', 'POST', event, true, cookies, validatedBody, accessToken)
               })

               if (!res) throwError(log,event, 'AUTH_SERVER_ERROR', 500, "Server Error", "Internal Server Error", `Server responded with null`);

               if (res.status === 429) {
                   const retrySec = res.headers.get('Retry-After');
                   event.res.headers.append("Retry-After", String(retrySec))
                   throwError(log,event,'FORBIDDEN',429,'To many requests','To many requests, please try again later');
                }

               const parsedRes = await parseResponseContentType(log, res) as ActionManagerResult;

               if (res.status !== 200 && !parsedRes.ok || !parsedRes.ok) {
                    event.res.status = res.status;
                    return {
                        ok: false,
                        date: parsedRes.date,
                        reason: parsedRes.reason
                    }
               }

               event.context.rotate = parsedRes.data as Extract<InternalUnion, ApiTokenRotationSuccess>;
               return handler(event);

            }

            // if we got to this point, the client is hitting an invalid action. throw and log
            throwError(log, event, 'NOT_FOUND', 404, 'Not found', "This page doesn't exists", "Client tried an invalid action")
      }) 

  ), 2000, "POST") as EventHandler<T, Promise<D>>
}