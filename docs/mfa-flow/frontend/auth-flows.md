# Frontend Auth Flows: The Complete Guide

This guide details how to implement the User Interface for all "Magic Link" based authentication flows using `auth-h3client`.

All flows share a single, unified mechanism: the `useMagicLink` composable.

## The Core Concept

Every magic link (Password Reset, MFA, Email Change) redirects the user to your app with query parameters (`token`, `random`, `reason`, `visitor`).

Your frontend implementation is always 2 steps:
1.  **Verify Link**: Call `await useMagicLink()` to validate the URL.
2.  **Submit Action**: Call the relevant API endpoint with the user's input AND the original query parameters.

---

## 1. Password Reset Flow

**Trigger:** User forgot password -> Clicks email link -> Lands on `/auth/reset-password`.

```vue
<!-- pages/auth/reset-password.vue -->
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useMagicLink, useRoute, navigateTo } from '#imports';

// 1. Validate Link
// Throws 404 if link is invalid/expired
const { token, random, reason, visitor } = await useMagicLink();

const form = reactive({ password: '', confirmedPassword: '' });
const error = ref('');

const resetPassword = async () => {
    try {
        // 2. Submit New Password
        await $fetch('/api/auth/reset-password', {
            method: 'POST',
            body: { 
                password: form.password,
                confirmedPassword: form.confirmedPassword 
            },
            // CRITICAL: Pass the original tokens back to prove identity
            query: { token, random, reason, visitor }
        });
        
        alert('Password reset successfully!');
        navigateTo('/login');
    } catch (err: any) {
        error.value = err.data?.message || 'Failed to reset password';
    }
};
</script>

<template>
  <div>
    <h1>Reset Your Password</h1>
    <input v-model="form.password" type="password" placeholder="New Password" />
    <input v-model="form.confirmedPassword" type="password" placeholder="Confirm Password" />
    <button @click="resetPassword">Save Password</button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
```

---

## 2. Login MFA Flow

**Trigger:** User logs in -> Suspicious activity/New Device -> Clicks "Verify" in email -> Lands on `/auth/verify`.

```vue
<!-- pages/auth/verify.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useMagicLink, useRoute, navigateTo } from '#imports';

// 1. Validate Link
const { token, random, reason, visitor } = await useMagicLink();

const code = ref('');

const verifyMfa = async () => {
    try {
        // 2. Submit 7-Digit Code
        await $fetch('/api/auth/verify-mfa', {
            method: 'POST',
            body: { code: code.value },
            query: { token, random, reason, visitor } 
        });
        
        // Success! Tokens are automatically rotated and set.
        navigateTo('/dashboard');
    } catch (err: any) {
        alert('Invalid code or expired link');
    }
};
</script>

<template>
  <div v-if="reason === 'magic_link_mfa_checks'">
    <h1>Verify It's You</h1>
    <p>Enter the 7-digit code sent to your email.</p>
    <input v-model="code" type="text" maxlength="7" placeholder="1234567" />
    <button @click="verifyMfa">Verify Login</button>
  </div>
</template>
```

---

## 3. Custom Sensitive Flows (e.g., Delete Account)

**Trigger:** User clicks "Delete Account" in settings -> Clicks email link -> Lands on `/auth/verify-action`.

```vue
<!-- pages/auth/verify-action.vue -->
<script setup lang="ts">
import { useMagicLink } from 'auth-h3client';

// 1. Validate Link
const data = await useMagicLink('/api/auth/verify-custom'); // Optional custom BFF endpoint

const code = ref('');

const confirmAction = async () => {
    // 2. Submit Code to YOUR custom endpoint
    await $fetch('/api/user/delete-account/confirm', {
        method: 'POST',
        body: { code: code.value },
        query: { 
            token: data.token, 
            random: data.random, 
            reason: data.reason, 
            visitor: data.visitor 
        }
    });
};
</script>

<template>
  <div v-if="data.reason === 'DELETE_ACCOUNT'">
    <h1>Confirm Account Deletion</h1>
    <button @click="confirmAction">Permanently Delete</button>
  </div>
</template>
```

---

## API Summary Cheat-Sheet

| Flow Type | `reason` (in URL) | Frontend Action | Standard API Endpoint |
| :--- | :--- | :--- | :--- |
| **Password Reset** | `password_reset` | Enter new password | `/api/auth/reset-password` |
| **Login MFA** | `magic_link_mfa_checks` | Enter 7-digit code | `/api/auth/verify-mfa` |
| **Email Change** | `change_email` | Enter code + password | `/api/user/update-email` |
| **Custom Flow** | `YOUR_CUSTOM_REASON` | Enter code | `YOUR_CUSTOM_ENDPOINT` |
