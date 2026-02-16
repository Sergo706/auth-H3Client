# Custom MFA Flow with Magic Links

This guide details how to implement custom Multi-Factor Authentication (MFA) flows for sensitive actions (e.g., "Delete Account", "Change Email") using the `useMagicLink` composable.

This flow leverages the `auth-h3client` library to handle the complexity of cryptographic token generation, email verification, and secure session rotation.

## Flow Overview

1.  **Initiation (Backend)**: Create a unique cryptographic token for the action and trigger an email.
2.  **Verification (Frontend/BFF)**: The user clicks the link. The BFF verifies uniqueness and signature; the Frontend uses `useMagicLink` to handle the state.
3.  **Execution (Backend)**: The user submits a 7-digit code (or the link itself completes the action). The server verifies the code and rotates authentication tokens.

---

## 1. Backend: Initiate the Flow

Create a POST endpoint that triggers the sensitive action. This endpoint generates a secure random token and asks the Auth Server to send a verification email.

**File:** `server/api/user/delete-account.post.ts`

```typescript
import { 
    defineAuthenticatedEventHandler, 
    askForMfaFlow, 
    getLogger 
} from 'auth-h3client/v1'; // or 'auth-h3client/v2'
import { randomBytes } from 'node:crypto';

export default defineAuthenticatedEventHandler(async (event) => {
    const log = getLogger("delete-account-flow");
    
    // 1. Generate a cryptographic salt/random for this specific transaction.
    // Store this in a DB or Cache if you need to strictly bind the flow to this request.
    const random = randomBytes(128).toString('hex'); 

    // 2. Initiate the flow with the Auth Server
    // "DELETE_ACCOUNT" is the unique 'reason' identifier for this action.
    const result = await askForMfaFlow(
        event, 
        log, 
        "DELETE_ACCOUNT", 
        random 
    );

    // 3. Handle errors (e.g., rate limits, user banned)
    if (!result.ok) {
        throw createError({ 
            statusCode: 400, 
            message: result.reason 
        });
    }

    // 4. Success: Email has been sent.
    return { 
        success: true, 
        message: "Verification email sent. Please check your inbox." 
    };
});
```

---

## 2. Backend: Verify Magic Link Signature

Create a GET endpoint that the Frontend will call to verify the magic link's signature. This ensures the user clicked a valid link before you show them the "Confirm" UI.

**File:** `server/api/auth/verify-custom.get.ts`

```typescript
import { defineVerifiedMagicLinkGetHandler } from 'auth-h3client/v1';

export default defineVerifiedMagicLinkGetHandler(async (event) => {
    // This handler ONLY executes if the link signature (HMAC) is valid.
    // The library automatically validates 'visitor', 'token', 'reason', and 'random'.

    const { link, reason } = event.context;
    
    // Return the valida data to the frontend so it knows which UI to show.
    return { 
        ok: true, 
        flow: reason, // e.g., "DELETE_ACCOUNT"
        type: link 
    };
});
```

---

## 3. Frontend: Verify & Submit with `useMagicLink`

Create a page to handle the landing experience. Use the `useMagicLink` composable to automatically parse URL parameters and validate them against your BFF endpoint.

**File:** `pages/auth/verify-action.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useMagicLink } from 'auth-h3client'; // Import the composable

// 1. Validate URL & Fetch Data
// This automatically:
// - Extracts 'token', 'random', 'reason', 'visitor' from route.query
// - Calls the provided BFF endpoint ('/api/auth/verify-custom')
// - Throws a 404 if the link is invalid or expired
const data = await useMagicLink('/api/auth/verify-custom');

// State for the 7-digit code input
const code = ref('');
const isSubmitting = ref(false);

const confirmAction = async () => {
    isSubmitting.value = true;
    try {
        // 2. Submit the verification code to your final execution endpoint
        await $fetch('/api/user/confirm-delete', {
            method: 'POST',
            body: { 
                code: code.value 
            },
            // IMPORTANT: You MUST pass the original query parameters back.
            // These contain the cryptographic proof the server needs.
            query: {
                visitor: data.visitor,
                token: data.token,
                random: data.random,
                reason: data.reason
            }
        });
        
        alert("Account Successfully Deleted");
        navigateTo('/');
    } catch (err) {
        alert("Verification failed. Code may be expired.");
    } finally {
        isSubmitting.value = false;
    }
};
</script>

<template>
  <div class="container">
    <!-- Show UI based on the 'reason' returned by the backend -->
    <div v-if="data.reason === 'DELETE_ACCOUNT'">
      <h1>Confirm Account Deletion</h1>
      <p>Please enter the 7-digit code from your email to confirm.</p>
      
      <input 
        v-model="code" 
        type="text" 
        placeholder="1234567" 
        maxlength="7" 
      />
      
      <button @click="confirmAction" :disabled="isSubmitting">
        {{ isSubmitting ? 'Verifying...' : 'Delete Account' }}
      </button>
    </div>

    <div v-else>
      <h1>Unknown Action</h1>
    </div>
  </div>
</template>
```

---

## 4. Backend: Final Execution

Create the final POST endpoint that verifies the 7-digit code and performs the sensitive action. This handler automatically handles **Token Rotation** to prevent session hijacking.

**File:** `server/api/user/confirm-delete.post.ts`

```typescript
import { defineMfaCodeVerifierHandler } from 'auth-h3client/v1';

export default defineMfaCodeVerifierHandler(async (event) => {
    // 1. Access Verified User Data
    // 'limitedMetaData' is populated ONLY if the MFA code is valid.
    const { userId, roles } = event.context.limitedMetaData;
    
    // 2. Perform the sensitive action
    // At this point, you are cryptographically sure this is the user.
    await db.deleteUser({ id: userId });
    
    // 3. Return success
    return { 
        success: true, 
        message: "Account deleted successfully." 
    };
});
```
