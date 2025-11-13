const blacklistedTokens = new Set();

export const addToBlacklist = (token) => {
  blacklistedTokens.add(token);
};

export const isBlacklisted = (token) => {
  return blacklistedTokens.has(token);
};
