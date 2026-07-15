import React, { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

export function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState("signIn");
  const [status, setStatus] = useState("idle");
  const signingIn = flow === "signIn";

  function onSubmit(event) {
    event.preventDefault();
    setStatus("submitting");
    const formData = new FormData(event.currentTarget);
    signIn("password", formData)
      .then(() => setStatus("idle"))
      .catch((error) => {
        console.error(error);
        setStatus("error");
      });
  }

  return (
    <main className="signInStage">
      <section className="signInCard">
        <p className="signInEyebrow">
          <span className="signInMark" aria-hidden="true" />
          Avantech CMS
        </p>
        <h1>{signingIn ? "Sign in to your site" : "Create your account"}</h1>
        <p className="signInLede">
          {signingIn
            ? "Edit your website and publish changes when you’re ready."
            : "Use the email your site access was set up with."}
        </p>

        <form onSubmit={onSubmit}>
          <label className="signInField">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="signInField">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete={signingIn ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>
          <input name="flow" type="hidden" value={flow} />

          {status === "error" && (
            <p className="signInError" role="alert">
              {signingIn
                ? "That email and password didn’t match. Try again."
                : "We couldn’t create this account. Check the email and password, then try again."}
            </p>
          )}

          <button className="signInSubmit" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "One moment…" : signingIn ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="signInFoot">
          {signingIn ? "First time here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="signInSwitch"
            onClick={() => {
              setStatus("idle");
              setFlow((current) => (current === "signIn" ? "signUp" : "signIn"));
            }}
          >
            {signingIn ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </section>

      <p className="signInHint">Your site access is tied to the email Avantech set up for you.</p>
    </main>
  );
}
