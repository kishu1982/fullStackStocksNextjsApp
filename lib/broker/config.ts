//Broker (Noren/Moneysukh) integration: auth, market data, orders

export const brokerConfig = {
  baseUrl: process.env.BROKER_BASE_URL!, // https://online.moneysukh.com
  wsUrl: process.env.BROKER_WS_URL!,
  clientId: process.env.BROKER_CLIENT_ID!,
  secretKey: process.env.BROKER_SECRET_KEY!,
  callbackUrl: process.env.BROKER_CALLBACK_URL!,
  authUrl: process.env.BROKER_AUTH_URL!,
};
