import React from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api.js";

export function SessionBar() {
  const { signOut } = useAuthActions();
  const access = useQuery(api.cms.getCmsAccess);

  return (
    <p className="sessionBar">
      {access?.email ? (
        <>
          Signed in as <strong>{access.email}</strong> ·{" "}
        </>
      ) : (
        <>Signed in · </>
      )}
      <button type="button" className="sessionSignOut" onClick={() => void signOut()}>
        Sign out
      </button>
    </p>
  );
}
