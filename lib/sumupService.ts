import type { Checkout, Currency, Customer } from '@sumup/sdk';
import SumUp from '@sumup/sdk';

// Re-export SDK types so callers don't need to import @sumup/sdk directly
export type { Checkout, Currency, Customer };

const apiKey =
  process.env.EXPO_PUBLIC_SUMUP_SECRET_KEY ??
  process.env.EXPO_PUBLIC_SUMUP_API_KEY ??
  '';

console.log('[SumUp] Initializing client', {
  keyPrefix: apiKey.slice(0, 10) + '…',
  keyType: apiKey.startsWith('sup_sk_') ? 'secret ✓' : apiKey.startsWith('sup_pk_') ? 'PUBLIC (needs sup_sk_!)' : 'unknown',
  merchantCode: process.env.EXPO_PUBLIC_SUMUP_MERCHANT_CODE ?? 'M8FP56ZC',
});

// Patch global fetch to log SumUp API requests/responses
const _originalFetch = globalThis.fetch;
globalThis.fetch = async function patchedFetch(input, init) {
  const url: string =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request)?.url ?? '';
  if (url.includes('api.sumup.com')) {
    // Headers can be a Headers instance, string[][], or plain object
    let authHeader = 'missing';
    const h = init?.headers;
    if (h instanceof Headers) {
      authHeader = h.get('authorization') ?? h.get('Authorization') ?? 'missing';
    } else if (Array.isArray(h)) {
      const entry = (h as string[][]).find(([k]) => k.toLowerCase() === 'authorization');
      authHeader = entry?.[1] ?? 'missing';
    } else if (h) {
      const o = h as Record<string, string>;
      authHeader = o['Authorization'] ?? o['authorization'] ?? 'missing';
    }
    const maskedAuth = authHeader !== 'missing' && authHeader.length > 20
      ? authHeader.slice(0, 20) + '…'
      : authHeader;
    console.log('[SumUp] →', init?.method ?? 'GET', url);
    console.log('[SumUp]   Authorization:', maskedAuth);
    console.log('[SumUp]   apiKey at call time:', apiKey ? apiKey.slice(0, 10) + '…' : '(empty!)');
    if (init?.body) {
      try { console.log('[SumUp]   Body:', JSON.parse(init.body as string)); }
      catch { console.log('[SumUp]   Body (raw):', init.body); }
    }
    const res = await _originalFetch(input, init);
    const cloned = res.clone();
    cloned.json().then((body) => {
      console.log('[SumUp] ←', res.status, url);
      console.log('[SumUp]   Response:', body);
    }).catch(() => {
      console.log('[SumUp] ←', res.status, url, '(non-JSON)');
    });
    return res;
  }
  return _originalFetch(input, init);
} as typeof fetch;

// REST API calls require a secret key (sup_sk_...).
// Set EXPO_PUBLIC_SUMUP_SECRET_KEY in .env — distinct from the public key
// (sup_pk_...) used by SumUpProvider in _layout.tsx.
const client = new SumUp({ apiKey });

const MERCHANT_CODE = process.env.EXPO_PUBLIC_SUMUP_MERCHANT_CODE ?? 'M8FP56ZC';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function createCheckout(
  amount: number,
  currency: Currency = 'EUR',
  description: string = 'FabLab Reservation',
  customerId?: string
): Promise<Checkout> {
  return client.checkouts.create({
    checkout_reference: generateUUID(),
    amount,
    currency,
    merchant_code: MERCHANT_CODE,
    description,
    return_url: process.env.EXPO_PUBLIC_PAYMENT_RETURN_URL,
    ...(customerId && { customer_id: customerId }),
  });
}

export async function getCheckout(checkoutId: string): Promise<Checkout> {
  return client.checkouts.get(checkoutId);
}

export async function createCustomer(
  customerId: string,
  firstName: string,
  lastName: string,
  email: string
): Promise<Customer> {
  return client.customers.create({
    customer_id: customerId,
    personal_details: { first_name: firstName, last_name: lastName, email },
  });
}

export async function getCustomer(customerId: string): Promise<Customer> {
  return client.customers.get(customerId);
}
