# SumUp Checkout Flow - FabLab Integration Setup

## Overview
This document describes the SumUp React Native Payment SDK integration implemented in the FabLab page. The checkout flow allows users to select a machine and process payments for FabLab equipment reservations.

## Files Created/Modified

### New Files:
1. **`lib/sumupService.ts`**
   - Service for handling backend checkout creation
   - Functions: `createCheckout()`, `createCustomer()`
   - Requires backend API endpoints to be configured

2. **`hooks/useCheckout.ts`**
   - Custom React hook for managing checkout state and payment flow
   - Functions: `initializePayment()`, `processPayment()`
   - Manages loading and error states

3. **`app/(tabs)/fablab.tsx`** (Updated)
   - Machine selection UI with pricing
   - Checkout card with payment confirmation
   - Integration with `useCheckout` hook

### Modified Files:
1. **`app/_layout.tsx`**
   - Added `SumUpProvider` wrapper
   - Requires API key configuration via environment variables

## Configuration

### Environment Variables
Create or update your `.env` file with the following variables:

```env
EXPO_PUBLIC_SUMUP_API_KEY=REDACTED_SUMUP_SECRET
EXPO_PUBLIC_SUMUP_MERCHANT_CODE=MXXXXXXX
```

To get these credentials:
1. Log in to [SumUp Dashboard](https://me.sumup.com/login)
2. Create an API Key in Account Settings
3. Get your Merchant Code from your account details
4. Set the `payment_instruments` scope for your API key

### Backend Setup

You need to create backend endpoints to handle checkout creation and customer management. Replace the URLs in `lib/sumupService.ts`:

**Endpoint 1: Create Checkout**
```
POST YOUR_BACKEND_API/checkouts
Headers:
  Authorization: Bearer $SUMUP_API_KEY
  Content-Type: application/json

Body:
{
  "checkout_reference": "uuid",
  "currency": "EUR",
  "amount": 9.99,
  "description": "FabLab Reservation",
  "merchant_code": "MXXXXXXX",
  "return_url": "myapp://payment/return",
  "redirect_url": "myapp://payment/redirect"
}
```

**Endpoint 2: Create Customer (Optional)**
```
POST YOUR_BACKEND_API/customers
Headers:
  Authorization: Bearer $SUMUP_API_KEY
  Content-Type: application/json

Body:
{
  "customer_id": "unique-customer-id",
  "personal_details": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "user@example.com"
  }
}
```

## User Flow

1. **Machine Selection**
   - User views available FabLab machines with pricing
   - User presses on a machine to select it
   - Selected machine is highlighted with a checkmark

2. **Checkout Confirmation**
   - Selected machine details appear in a checkout card
   - Displays total price
   - Two options: "Proceed to Payment" or "Cancel"

3. **Payment Processing**
   - "Proceed to Payment" initializes the SumUp payment sheet
   - SumUp payment sheet is presented to the user
   - User enters payment details (card, Apple Pay, Google Pay)
   - System processes the payment

4. **Completion**
   - Success alert on successful payment
   - Error alert if payment fails
   - Machine selection cleared on success

## Machine Data
Currently, machines are defined in-memory in `fablab.tsx`:

```typescript
const MACHINES: Machine[] = [
  { id: '1', name: 'Prusa Core One+', price: 15.99 },
  { id: '2', name: 'Ultimaker 2+ (0.6mm)', price: 25.99 },
  { id: '3', name: 'Ultimaker 2+ (0.2mm)', price: 35.99 },
  { id: '4', name: 'Ender 3 Pro', price: 12.99 },
];
```

To make this dynamic, consider:
- Fetching from a database
- Adding time-slot selection
- Implementing user authentication for saved cards

## Customization

### Changing Machine Prices
Edit the `MACHINES` array in `app/(tabs)/fablab.tsx`

### Customizing UI Colors
The component uses `#87b72f` as the primary color (FabLab green). Modify the color codes in styles or component code to customize.

### Adding More Payment Options
The SumUp SDK supports:
- Google Pay (requires `googlePay` configuration)
- Apple Pay (requires merchant ID setup)
- Standard card payments

See `hooks/useCheckout.ts` to extend with these options.

## Error Handling
The checkout flow includes error handling for:
- Checkout creation failures
- Payment sheet initialization errors
- Payment processing failures

All errors are displayed via alert dialogs with user-friendly messages.

## Testing
For testing payments:
1. Use SumUp's sandbox credentials
2. Request a sandbox merchant account from [SumUp Support](/contact)
3. Use test card numbers provided by SumUp

## Notes
- The Apple Pay integration has a known issue where backend doesn't process payments (see SumUp documentation)
- Ensure `react-native-localization` is installed for automatic language detection
- The `uuid` package is used for generating checkout references (make sure it's installed)

## Related Documentation
- [SumUp React Native SDK Guide](./sumup.md)
- [SumUp API Documentation](https://developer.sumup.com)
