"use client";

import { useSyncExternalStore } from "react";

const semAssinatura = () => () => {};

function lerModoTelao(): boolean {
  return new URLSearchParams(window.location.search).get("telao") === "1";
}

/** `?telao=1` na URL — tela grande só com "de quem é a vez", sem gate de
 *  identidade, pra deixar num televisor/notebook central da mesa. */
export function useModoTelao(): boolean {
  return useSyncExternalStore(semAssinatura, lerModoTelao, () => false);
}
