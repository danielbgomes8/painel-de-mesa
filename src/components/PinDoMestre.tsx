"use client";

import { useEffect, useState } from "react";
import { limparPin, pinValido } from "@/lib/pinMestre";
import { gravarPinDaSala, lerPinDaSala } from "@/lib/pinMestreBanco";
import { relatarErro } from "@/lib/relatarErro";

type Fase = "lendo" | "sem-pin" | "com-pin" | "digitando" | "falhou-leitura";

/** Liga, troca ou tira o PIN do Mestre desta campanha (aba Mestre > Sala).
 *  O PIN só vale pra quem toca em "Sou o Mestre" num aparelho novo: quem já
 *  entrou continua entrando. A confirmação só aparece depois de o banco aceitar. */
export function PinDoMestre({ codigo }: { codigo: string }) {
  const [fase, setFase] = useState<Fase>("lendo");
  const [pin, setPin] = useState("");
  const [repetido, setRepetido] = useState("");
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; falhou: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    lerPinDaSala(codigo).then((r) => {
      if (!vivo) return;
      setFase(!r.ok ? "falhou-leitura" : r.guardado ? "com-pin" : "sem-pin");
    });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  async function gravar(novo: string | null) {
    setGravando(true);
    setAviso(null);
    const ok = await gravarPinDaSala(codigo, novo);
    setGravando(false);
    if (!ok) {
      relatarErro("gravarPinDoMestre", "o banco não aceitou o PIN (migration 0041 rodada?)");
      setAviso({ texto: "Não consegui gravar o PIN. Confira a conexão e tente de novo.", falhou: true });
      return;
    }
    setPin("");
    setRepetido("");
    setFase(novo ? "com-pin" : "sem-pin");
    setAviso({ texto: novo ? "PIN gravado." : "PIN removido.", falhou: false });
  }

  function confirmar() {
    if (!pinValido(pin)) return setAviso({ texto: "O PIN tem de 4 a 6 números.", falhou: true });
    if (pin !== repetido) return setAviso({ texto: "Os dois PINs não são iguais.", falhou: true });
    gravar(pin);
  }

  return (
    <div className="combat">
      <div className="combat-head">
        <h2>PIN do Mestre</h2>
      </div>
      <p className="bkpexplica">
        Evita que um jogador entre como Mestre sem querer e veja seus planos. Quem já entrou neste aparelho não
        precisa digitar de novo. É uma trava contra toque errado, não contra quem queira mexer no banco.
      </p>

      {fase === "lendo" && <p className="bkpexplica">Conferindo…</p>}
      {fase === "falhou-leitura" && <p className="bkpexplica">Não consegui ler o PIN agora. Recarregue a página.</p>}

      {(fase === "sem-pin" || fase === "com-pin") && (
        <div className="pinlinha">
          <button type="button" onClick={() => setFase("digitando")}>
            {fase === "com-pin" ? "trocar o PIN" : "criar um PIN"}
          </button>
          {fase === "com-pin" && (
            <button type="button" className="pinvoltar" onClick={() => gravar(null)} disabled={gravando}>
              tirar o PIN
            </button>
          )}
        </div>
      )}

      {fase === "digitando" && (
        <>
          <div className="pinlinha">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              placeholder="novo PIN (4 a 6 números)"
              aria-label="Novo PIN do Mestre"
              onChange={(e) => setPin(limparPin(e.target.value))}
            />
          </div>
          <div className="pinlinha">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={repetido}
              placeholder="repita o PIN"
              aria-label="Repita o PIN do Mestre"
              onChange={(e) => setRepetido(limparPin(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
              }}
            />
            <button type="button" onClick={confirmar} disabled={gravando}>
              {gravando ? "…" : "gravar"}
            </button>
            <button
              type="button"
              className="pinvoltar"
              onClick={() => {
                setFase("sem-pin");
                lerPinDaSala(codigo).then((r) => setFase(r.ok && r.guardado ? "com-pin" : "sem-pin"));
                setPin("");
                setRepetido("");
                setAviso(null);
              }}
            >
              cancelar
            </button>
          </div>
        </>
      )}

      <div className="pinaviso" role="status" aria-live="polite" style={{ textAlign: "left", marginTop: 8 }}>
        {aviso?.texto ?? ""}
      </div>
    </div>
  );
}
