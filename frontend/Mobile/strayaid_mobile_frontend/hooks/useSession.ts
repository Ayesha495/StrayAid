import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { getToken } from "../utils/tokenStorage";

// Whether someone is signed in. Re-checked whenever the screen regains focus,
// so returning from login updates guest-only UI straight away.
export function useSession() {
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getToken()
        .then((token) => active && setIsSignedIn(!!token))
        .catch(() => active && setIsSignedIn(false));
      return () => {
        active = false;
      };
    }, [])
  );

  return { isSignedIn: isSignedIn === true, isChecking: isSignedIn === null };
}
