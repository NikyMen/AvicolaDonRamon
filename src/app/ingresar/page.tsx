"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, KeyRound, Mail, Phone, User, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

type Step = "phone" | "code";
type LoginMethod = "phone" | "document";
const PHONE_PREFIX = "+549";
const PHONE_DIGITS_LENGTH = 10;

function IngresarForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [step, setStep] = useState<Step>("phone");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("phone");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = `${PHONE_PREFIX}${phoneDigits}`;
  const activePhone = otpPhone || phone;

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (loginMethod === "phone" && phoneDigits.length !== PHONE_DIGITS_LENGTH) {
      setError("Ingresá característica + número, sin 0 ni 15. Ej: 3794525617.");
      return;
    }
    if (loginMethod === "document" && document.trim().length < 3) {
      setError("Ingresá un documento válido.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(loginMethod === "phone" ? { phone } : { document: document.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo enviar el código.");
      setOtpPhone(json?.data?.phone ?? "");
      setIsFirstLogin(Boolean(json?.data?.isFirstLogin));
      setStep("code");
      setCode("");
      setNotice(
        json?.data?.delivery === "console"
          ? "Código generado. Revisá la consola del servidor."
          : "Te enviamos un código por WhatsApp. También queda visible en consola por ahora."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: activePhone,
          code,
          ...(isFirstLogin
            ? {
                name: name.trim(),
                document: document.trim(),
                email: email.trim(),
              }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "El código no es válido.");
      router.replace(next || "/cuenta");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h1 className="text-xl font-bold text-brand-ink">Ingresá con tu teléfono</h1>
          <p className="mt-1 text-sm text-brand-ink/55">
            {step === "phone"
              ? loginMethod === "phone"
                ? "Poné solo característica + número para recibir el código."
                : "Ingresá el documento de una cuenta existente."
              : isFirstLogin
                ? "Es tu primer ingreso. Completá tus datos y verificá el código."
                : `Ingresá el código de 4 dígitos enviado al teléfono registrado.`}
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {notice && (
            <p className="mt-4 rounded-lg bg-brand-gold/15 px-3 py-2 text-sm text-brand-ink/70">
              {notice}
            </p>
          )}

          {step === "phone" ? (
            <form onSubmit={requestCode} className="mt-5 space-y-3">
              {loginMethod === "phone" ? (
                <>
                  <Field icon={Phone}>
                    <span className="shrink-0 font-semibold text-brand-ink">{PHONE_PREFIX}</span>
                    <input
                      type="tel"
                      autoFocus
                      required
                      inputMode="tel"
                      maxLength={PHONE_DIGITS_LENGTH}
                      placeholder="3794525617"
                      value={phoneDigits}
                      onChange={(e) =>
                        setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, PHONE_DIGITS_LENGTH))
                      }
                      className="w-full bg-transparent text-brand-ink outline-none placeholder:text-brand-ink/35"
                    />
                  </Field>
                  <p className="px-1 text-xs text-brand-ink/45">
                    Se envía como {PHONE_PREFIX}3794525617. Sin 0 ni 15.
                  </p>
                </>
              ) : (
                <Field icon={FileText}>
                  <input
                    type="text"
                    autoFocus
                    required
                    inputMode="numeric"
                    placeholder="Documento / DNI"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    className="w-full bg-transparent text-brand-ink outline-none placeholder:text-brand-ink/35"
                  />
                </Field>
              )}
              <SubmitButton loading={loading}>Enviar código</SubmitButton>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod((method) => (method === "phone" ? "document" : "phone"));
                  setError(null);
                  setNotice(null);
                }}
                className="w-full py-2 text-sm font-semibold text-brand-ink/60 hover:text-brand-ink"
              >
                {loginMethod === "phone" ? "Ingresar con documento" : "Ingresar con teléfono"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="mt-5 space-y-3">
              {isFirstLogin && (
                <>
                  <p className="rounded-lg bg-brand-cream/60 px-3 py-2 text-xs text-brand-ink/65">
                    Solo te los pedimos una vez para crear tu cuenta.
                  </p>
                  <Field icon={User}>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Nombre completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent text-brand-ink outline-none placeholder:text-brand-ink/35"
                    />
                  </Field>
                  <Field icon={FileText}>
                    <input
                      type="text"
                      required
                      placeholder="Documento"
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      className="w-full bg-transparent text-brand-ink outline-none placeholder:text-brand-ink/35"
                    />
                  </Field>
                  <Field icon={Mail}>
                    <input
                      type="email"
                      required
                      placeholder="Correo electrónico"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-brand-ink outline-none placeholder:text-brand-ink/35"
                    />
                  </Field>
                </>
              )}
              <Field icon={KeyRound}>
                <input
                  type="text"
                  autoFocus
                  required
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="Código de 4 dígitos"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full bg-transparent text-brand-ink outline-none placeholder:text-brand-ink/35"
                />
              </Field>
              <SubmitButton loading={loading}>Verificar código</SubmitButton>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setIsFirstLogin(false);
                  setError(null);
                  setNotice(null);
                }}
                className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-brand-ink/60"
              >
                <ArrowLeft size={16} /> Cambiar número
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-brand-ink/45">
          <Link href="/" className="hover:text-brand-ink">
            Volver a la tienda
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/10 px-4 py-3 focus-within:border-brand-red">
      <Icon size={18} className="shrink-0 text-brand-red" />
      {children}
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export default function IngresarPage() {
  return (
    <Suspense fallback={null}>
      <IngresarForm />
    </Suspense>
  );
}
