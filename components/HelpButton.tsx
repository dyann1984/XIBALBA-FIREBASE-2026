"use client";

/** Botón de ayuda permanente: visible en cualquier pantalla, abre un aviso
 * corto y lleva al Escudo Global. No detecta el país por geolocalización —
 * eso exigiría un consentimiento propio y separado, que todavía no existe;
 * la persona elige su país ya dentro del directorio. */

import { useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";

export default function HelpButton({ onOpenDirectory }: { onOpenDirectory: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="help-floating">
      {open && (
        <div className="help-panel" role="dialog" aria-label={t("globalShield", "helpPanelTitle")}>
          <button type="button" className="help-panel-close" aria-label={t("globalShield", "helpPanelClose")} onClick={() => setOpen(false)}>
            <X size={15} />
          </button>
          <h3>{t("globalShield", "helpPanelTitle")}</h3>
          <p>{t("globalShield", "helpPanelText")}</p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setOpen(false);
              onOpenDirectory();
            }}
          >
            {t("globalShield", "openDirectory")}
          </button>
        </div>
      )}
      <button type="button" className="help-fab" onClick={() => setOpen((value) => !value)} aria-pressed={open}>
        <LifeBuoy size={18} /> {t("globalShield", "helpButton")}
      </button>
    </div>
  );
}
