import { Store } from "bonsai-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

export function createStoreContext<State, Actions>(
  useCreate: () => Store<State> & { actions: Actions },
) {
  const Context = createContext<(Store<State> & { actions: Actions }) | null>(
    null,
  );

  function Scope({ children }: { children: ReactNode }) {
    const store = useCreate();
    return <Context.Provider value={store}>{children}</Context.Provider>;
  }

  function useStore() {
    const store = useContext(Context);
    if (!store) throw new Error("Store scope is missing");
    return store;
  }

  function useActions() {
    return useStore().actions;
  }

  function useScopedHook<Hook>(create: (store: Store<State>) => Hook): Hook {
    const store = useStore();
    return useMemo(() => create(store), [store]);
  }

  return { Scope, useActions, useScopedHook };
}
