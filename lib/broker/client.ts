//server-side REST wrapper for the rest of the API (quotes, orders, positions): broker api page for reff: https://www.moneysukh.com/api.html
import { brokerConfig } from "./config";

async function post<T = any>(
  path: string,
  jData: Record<string, any>,
  jKey: string,
): Promise<T> {
  const bodyString = `jData=${JSON.stringify(jData)}&jKey=${jKey}`;

  const res = await fetch(`${brokerConfig.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyString,
  });
  return res.json();
}

export const brokerClient = {
  getQuotes: (uid: string, exch: string, token: string, jKey: string) =>
    post("/GetQuotes", { uid, exch, token }, jKey),

  searchScrip: (uid: string, stext: string, exch: string, jKey: string) =>
    post("/SearchScrip", { uid, stext, exch }, jKey),

  placeOrder: (
    params: {
      uid: string;
      actid: string;
      exch: string;
      tsym: string;
      qty: string;
      prc: string;
      prd: string;
      trantype: "B" | "S";
      prctyp: string;
      ret: string;
    },
    jKey: string,
  ) => post("/PlaceOrder", params, jKey),

  orderBook: (uid: string, jKey: string) => post("/OrderBook", { uid }, jKey),

  positionBook: (uid: string, actid: string, jKey: string) =>
    post("/PositionBook", { uid, actid }, jKey),
};
