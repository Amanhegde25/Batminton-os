import { handler, ok } from "@/lib/api";
import { clearSession } from "@/server/auth/session";

export const POST = handler(async () => {
  return clearSession(ok({ loggedOut: true }));
});
