# Firestore Security Rules Spec - AI Campaigns

## 1. Data Invariants
- An `AICampaign` can only be read, created, updated, or deleted by authenticated Administrators (`isAdmin()`).
- An `AICampaignLead` belongs to a specific `AICampaign` parent document, and can only be modified or read by an Administrator.
- An `AICampaignLog` belongs to a specific `AICampaign` parent document, and can only be read by an Administrator.
- `AICampaignSettings` is a singleton collection where any read or write operation requires `isAdmin()`.
- System-generated fields like `createdAt` and `updatedAt` are immutable or verified against the server time `request.time`.

---

## 2. The "Dirty Dozen" Payloads
These payloads represent malicious attempts to bypass identity, integrity, and rate-limiting controls.

### Payload 1: Unauthorized Creation of an AI Campaign
Attempting to create a campaign without being an Administrator.
```json
{
  "path": "/aiCampaigns/hacked-campaign",
  "auth": { "uid": "normal-user", "token": { "email": "hacker@gmail.com", "email_verified": true } },
  "data": {
    "title": "Malicious Promo",
    "status": "active",
    "geminiModel": "flash",
    "instructions": "Send spam"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 2: Privilege Escalation in Profile User Creation
Attempting to register as a custom admin by setting self-assigned roles.
```json
{
  "path": "/users/hacker-uid",
  "auth": { "uid": "hacker-uid" },
  "data": {
    "uid": "hacker-uid",
    "email": "hacker@gmail.com",
    "isAdmin": true
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 3: Spoofing Admin Identity via Unverified Email
An authenticated user attempts to write to global settings because their email matches the admin's, but `email_verified` is `false`.
```json
{
  "path": "/aiCampaignSettings/global",
  "auth": { "uid": "fake-admin", "token": { "email": "muhammadbilalrasheed78@gmail.com", "email_verified": false } },
  "data": {
    "imageStrategy": "option2-unsplash-dynamic"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 4: Injecting Malicious Large String into Campaign ID (Resource Poisoning)
An attacker attempts to write an AI campaign with a 1MB string as the document ID.
```json
{
  "path": "/aiCampaigns/extremely-long-garbage-id-exceeding-128-characters-acting-as-a-denial-of-wallet-vector-to-overwhelm-indices-and-exhaust-memory-buffers",
  "auth": { "uid": "muhammadbilalrasheed78@gmail.com", "token": { "email": "muhammadbilalrasheed78@gmail.com", "email_verified": true } },
  "data": {
    "title": "Legitimate Title",
    "status": "draft",
    "geminiModel": "flash",
    "instructions": "Be creative"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 5: Client Bypassing Validation via Direct State Lock Jumping
Attempting to directly change status to "completed" in draft campaign.
```json
{
  "path": "/aiCampaigns/campaign-123",
  "auth": { "uid": "normal-user" },
  "data": {
    "status": "completed"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 6: Modifying Log Entry (System Field Security)
Attempting to tamper with execution log parameters under an AI campaign.
```json
{
  "path": "/aiCampaigns/camp-1/logs/log-1",
  "auth": { "uid": "malicious-user" },
  "data": {
    "status": "sent",
    "errorMessage": "No error actually occurred, hacking status"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 7: Client Modifying AICampaignSettings
Attempting to override Gemini RPM limits without authorization.
```json
{
  "path": "/aiCampaignSettings/global",
  "auth": { "uid": "not-admin" },
  "data": {
    "modelConfigs": {
      "flash": { "rpm": 9999 }
    }
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 8: Blanket Retrieval of Leads list by Guest
Attempting to fetch the whole list of leads without admin credentials.
```json
{
  "path": "/aiCampaigns/camp-1/leads",
  "auth": null,
  "method": "list"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 9: Hijacking Another User's Lead Record
Modifying status of lead to generated without admin permissions.
```json
{
  "path": "/aiCampaigns/camp-1/leads/lead-99",
  "auth": { "uid": "normal-user" },
  "data": {
    "status": "generated"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 10: Injecting Malicious Fields (Shadow Fields)
Creating a campaign with unapproved fields (e.g. `isVerifiedBySystem`).
```json
{
  "path": "/aiCampaigns/camp-valid",
  "auth": { "uid": "muhammadbilalrasheed78@gmail.com", "token": { "email": "muhammadbilalrasheed78@gmail.com", "email_verified": true } },
  "data": {
    "title": "AI Campaign",
    "status": "draft",
    "geminiModel": "flash",
    "instructions": "Standard",
    "shadowField": "injected-content"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 11: Tampering with Temporal Timestamps
Attempting to set `createdAt` in the future instead of using `request.time`.
```json
{
  "path": "/aiCampaigns/camp-valid",
  "auth": { "uid": "muhammadbilalrasheed78@gmail.com", "token": { "email": "muhammadbilalrasheed78@gmail.com", "email_verified": true } },
  "data": {
    "title": "Campaign",
    "status": "draft",
    "geminiModel": "flash",
    "instructions": "Standard",
    "createdAt": "2030-01-01T00:00:00Z"
  }
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 12: Changing Immutable campaignId after Creation
Attempting to modify the primary model during updates.
```json
{
  "path": "/aiCampaigns/camp-1",
  "auth": { "uid": "muhammadbilalrasheed78@gmail.com", "token": { "email": "muhammadbilalrasheed78@gmail.com", "email_verified": true } },
  "data": {
    "title": "Campaign Update",
    "status": "draft",
    "geminiModel": "2.5-pro",
    "instructions": "Standard"
  }
}
```
*Expected Result: PERMISSION_DENIED*

---

## 3. Test Runner Schema (firestore.rules.test.ts)
Below is a mock test runner demonstrating the assertions.

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("AI Campaign Security Rules", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "ai-studio-applet",
      firestore: { rules: require("fs").readFileSync("firestore.rules", "utf8") }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should deny unauthorized campaign creation (Payload 1)", async () => {
    const context = testEnv.authenticatedContext("normal-user", { email: "hacker@gmail.com", email_verified: true });
    await assertFails(context.firestore().doc("aiCampaigns/hacked-campaign").set({
      title: "Malicious Promo",
      status: "active",
      geminiModel: "flash",
      instructions: "Send spam"
    }));
  });

  it("should allow verified admin campaign creation", async () => {
    const context = testEnv.authenticatedContext("admin-user", {
      email: "muhammadbilalrasheed78@gmail.com",
      email_verified: true
    });
    await assertSucceeds(context.firestore().doc("aiCampaigns/valid-campaign").set({
      title: "AI Promo",
      status: "draft",
      geminiModel: "flash",
      imageStrategy: "option1-keyword",
      instructions: "Generate creative email."
    }));
  });
});
```
