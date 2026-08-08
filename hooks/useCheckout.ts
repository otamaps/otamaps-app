/**
 * Hook for managing SumUp checkout flow
 */

import { useSumUp } from 'sumup-react-native-alpha';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { createCheckout } from '@/lib/sumupService';

interface CheckoutState {
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
}

export function useCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useSumUp();
  const [state, setState] = useState<CheckoutState>({
    isLoading: false,
    error: null,
    isProcessing: false,
  });

  /**
   * Initialize the payment sheet with a checkout
   */
  const initializePayment = useCallback(
    async (amount: number, customerId?: string) => {
      setState({ isLoading: true, error: null, isProcessing: false });

      try {
        // Create checkout on backend
        const checkout = await createCheckout(amount);
        if (!checkout.id) {
          throw new Error('SumUp did not return a checkout identifier');
        }

        // Initialize the payment sheet
        const { error } = await initPaymentSheet({
          checkoutId: checkout.id,
          customerId: customerId,
          language: 'en',
        });

        if (error) {
          const errorMessage =
            error.status === 'failure'
              ? error.message
              : 'Payment setup was canceled';
          setState({
            isLoading: false,
            error: errorMessage,
            isProcessing: false,
          });
          Alert.alert('Payment Error', errorMessage);
          return false;
        }

        setState({ isLoading: false, error: null, isProcessing: false });
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setState({
          isLoading: false,
          error: errorMessage,
          isProcessing: false,
        });
        Alert.alert('Error', errorMessage);
        return false;
      }
    },
    [initPaymentSheet]
  );

  /**
   * Present the payment sheet and process payment
   */
  const processPayment = useCallback(async () => {
    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        const errorMessage =
          error.status === 'failure' ? error.message : 'Payment was canceled';
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: errorMessage,
        }));
        Alert.alert('Payment Failed', errorMessage);
        return false;
      }

      setState({
        isLoading: false,
        error: null,
        isProcessing: false,
      });
      Alert.alert(
        'Success',
        'Your payment has been processed successfully!'
      );
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setState({
        isLoading: false,
        error: errorMessage,
        isProcessing: false,
      });
      Alert.alert('Error', errorMessage);
      return false;
    }
  }, [presentPaymentSheet]);

  return {
    ...state,
    initializePayment,
    processPayment,
  };
}
