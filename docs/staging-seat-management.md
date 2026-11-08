# Navigator staging seats and manual activation

## Plan owner

- The owner occupies one seat. Essential allows 2 seats, Professional 5, and Advanced 8, including the owner.
- In the active plan, open **Manage plan seats**, enter the person’s email address and select **Assign or invite member**. Confirmed accounts are assigned immediately. New members receive an invitation and the seat is reserved for up to ten minutes, or until editing ends if sooner.
- The member opens the invitation link and then signs in with a six-digit email code. The reservation becomes an assigned seat when the verified member opens **My workspace**.
- Pending invitations appear in the owner’s seat list. Cancel one to release the reservation. If an invitation expires, send a fresh invitation. If delivery is unconfirmed, check the pending list before retrying. Wait at least a minute between sends to the same address.
- Remove an assigned member to free the seat. During the read-only window, existing members retain review access and the owner can see seat assignments. Seat changes require an active editing term. A new staging order starts with just the owner’s seat.
- Assigning a seat gives access to plan tools. Each member keeps their own recovery file. Handle any inquiry handover through the institution’s approved process.

## Administrator

1. Check the customer’s approved email, agreed plan and validity dates, and the independent purchase or administrative authorisation reference. Use the dedicated Navigator staging project for test accounts.
2. If the account is missing, use **Supabase → Authentication → Users → Add user → Send invitation**. Ask the customer to confirm their email and sign in using a Navigator email code. For a person joining an existing plan, use that plan’s owner-managed seat invitation so the seat limit is applied.
3. Sign in to **Navigator → Administrator**, select **Find confirmed account**, and verify the exact match. Review the existing access entries before assigning or renewing anything.
4. Select the plan. Review the start and exclusive end dates in India time, confirm the independent verification checkbox, and select **Assign plan access**. Record the administrative reference and check the resulting entitlement. Use **Revoke this access** for a documented correction or removal.
5. Ask the customer to check **My workspace**. Use a separate account tab if they have work open. Never ask for an email code, password, evidence, or a recovery file in support.

Administrator grants and owner-managed staging test orders are separate records. Use manual grants for independently authorised access. Use the owner’s seat list for people sharing a staging order. Staging checkout remains in Razorpay test mode.
