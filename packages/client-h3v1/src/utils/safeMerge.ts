type MergeMode = "drop" | "throw";
/**
 * Safely merges properties from a source object into a target object,
 * protecting a set of reserved keys from being overwritten.
 * @param target The object to merge properties into. This object is modified directly.
 * @param src The object to merge properties from.
 * @param opts Options to control the merge behavior.
 * @param reservedKeys A set of keys to protect from being overwritten in the `target`.
 * @description Reserved keys in `target` are never overwritten. They can only be
 * set if they are initially null or undefined in the `target`.
 */
export function safeObjectMerge(
  target: Record<string, unknown>,
  src: Record<string, unknown>,
  opts: { mode?: MergeMode; onConflict?: (key: string, incoming: unknown, existing: unknown) => void } = {},
  extraReserved?: Set<string>,
) {

  const defaultReserved: ReadonlySet<string> = new Set<string>([
    'sub','name','given_name','family_name','middle_name','nickname','preferred_username',
    'profile','picture','website','zoneinfo','locale','updated_at','email','email_verified',
    'phone_number','phone_number_verified','address',
    'iss','aud','exp','nbf','iat','jti',
    'id','user_id','provider','avatar','avatar_url',
    'accessToken','access_token','refresh_token','token_type',
    'azp','nonce','auth_time','at_hash','c_hash'
  ]);

  const reserved = extraReserved ? new Set<string>([...defaultReserved, ...extraReserved]) : defaultReserved;
  const mode = opts.mode ?? "drop";

  for (const [key, value] of Object.entries(src)) {

    if (reserved.has(key)) {

      if (target[key] == null) {
        target[key] = value;
      } else {
        opts.onConflict?.(key, value, target[key]);
        if (mode === "throw") {
            throw new Error(`Attempted to overwrite reserved key "${key}"`);
        }
      }
      continue;
    } else {
      target[key] = value;
    }
  }
    return target;
}
