// src/utils/coinCalculator.js

/**
 * Calculate coin discount for an order
 * Business Rules:
 * - 100 coins = Rs. 10
 * - Maximum 30% of order total can be paid with coins
 */
export const calculateCoinDiscount = (orderTotal, coinsToUse, userCoins) => {
    const COIN_TO_CURRENCY = 0.1; // 100 coins = Rs. 10
    const MAX_DISCOUNT_PERCENT = 30;

    // Validate user has enough coins
    if (coinsToUse > userCoins) {
        throw new Error('Insufficient coins');
    }

    if (coinsToUse < 0 || orderTotal < 0) {
        throw new Error('Invalid values');
    }

    // Calculate potential discount
    const potentialDiscount = coinsToUse * COIN_TO_CURRENCY;

    // Calculate max allowed discount (30% of order)
    const maxAllowedDiscount = orderTotal * (MAX_DISCOUNT_PERCENT / 100);

    // Use lesser of the two
    const actualDiscount = Math.min(potentialDiscount, maxAllowedDiscount);

    // Calculate actual coins to deduct (rounded down)
    const actualCoinsUsed = Math.floor(actualDiscount / COIN_TO_CURRENCY);

    return {
        coinsUsed: actualCoinsUsed,
        coinDiscount: parseFloat(actualDiscount.toFixed(2)),
        newTotal: parseFloat((orderTotal - actualDiscount).toFixed(2)),
        maxCoinsAllowed: Math.floor(maxAllowedDiscount / COIN_TO_CURRENCY)
    };
};

/**
 * Validate coin redemption request
 */
export const validateCoinRedemption = (orderTotal, coinsToUse) => {
    if (!orderTotal || orderTotal <= 0) {
        return { valid: false, error: 'Invalid order total' };
    }

    if (!coinsToUse || coinsToUse < 0) {
        return { valid: false, error: 'Invalid coin amount' };
    }

    if (coinsToUse < 100) {
        return { valid: false, error: 'Minimum 100 coins required' };
    }

    return { valid: true };
};
