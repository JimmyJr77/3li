import { createContext, useCallback, useContext, type MouseEvent as ReactMouseEvent } from "react";

export type BrainstormNodeContextMenuRequest = (
  e: ReactMouseEvent<Element> | globalThis.MouseEvent,
  nodeId: string,
) => void;

export const BrainstormNodeContextMenuRequestContext = createContext<BrainstormNodeContextMenuRequest>(() => {});

/** Attach to the node root as `onContextMenuCapture` so nested controls (inputs, images) still open the board menu. */
export function useBrainstormNodeRootContextMenu(nodeId: string) {
  const request = useContext(BrainstormNodeContextMenuRequestContext);
  return useCallback(
    (e: ReactMouseEvent<Element>) => {
      e.preventDefault();
      request(e, nodeId);
    },
    [request, nodeId],
  );
}
