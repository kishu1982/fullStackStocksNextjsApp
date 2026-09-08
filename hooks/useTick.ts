// "use client";

// import { useEffect, useState } from "react";
// import { brokerSocketManager } from "@/lib/broker/socketManager";

// export function useTick(exch: string, tokens: string | string[]) {
//   const [ticks, setTicks] = useState<Record<string, any>>({});

//   useEffect(() => {
//     if (!exch || !tokens) return;

//     const tokenList = Array.isArray(tokens) ? tokens : [tokens];

//     if (tokenList.length === 0) return;

//     const unsubscribe = brokerSocketManager.onTick((msg) => {
//       if (msg.e === exch && tokenList.includes(String(msg.tk))) {
//         setTicks((prev) => ({
//           ...prev,
//           [String(msg.tk)]: {
//             ...prev[String(msg.tk)],
//             ...msg,
//           },
//         }));
//       }
//     });

//     // Subscribe to all tokens
//     tokenList.forEach((token) => {
//       brokerSocketManager.subscribe(exch, token);
//     });

//     return () => {
//       unsubscribe();

//       // Unsubscribe from all tokens
//       tokenList.forEach((token) => {
//         brokerSocketManager.unsubscribe(exch, token);
//       });
//     };
//   }, [exch, JSON.stringify(tokens)]);

//   return ticks;
// }
