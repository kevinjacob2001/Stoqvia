import { useCallback, useEffect, useState } from "react";
import {
  createTransfer,
  dispatchTransfer,
  fetchMe,
  fetchMyTransfers,
  fetchRequestOptions,
  fetchStoreForecasts,
  fetchStoreInventory,
  fetchTransferDetail,
  login,
  respondToTransfer,
} from "./api.ts";
import { clearToken, getToken, setToken } from "./auth.ts";
import InventoryTable, { buildActiveFulfillments } from "./sections/InventoryTable.tsx";
import LoadError from "./sections/LoadError.tsx";
import LoadingState from "./sections/LoadingState.tsx";
import LoginForm from "./sections/LoginForm.tsx";
import RequestOptionsModal from "./sections/RequestOptionsModal.tsx";
import StoreNav, { pathToView, VIEW_PATHS, type HomeView } from "./sections/StoreNav.tsx";
import TransferTables from "./sections/TransferTables.tsx";
import type {
  ForecastResponse,
  MeResponse,
  MyTransfersResponse,
  RequestOptionsResponse,
  RespondAction,
  StoreInventoryResponse,
  TransferDetail,
} from "./types.ts";

function readRoute(): { view: HomeView; transferId: string | null } {
  const view = pathToView(window.location.pathname);
  const transferId = new URLSearchParams(window.location.search).get("id");
  return { view, transferId };
}

function writeRoute(view: HomeView, transferId: string | null = null, replace: boolean = false) {
  const path = VIEW_PATHS[view];
  const next = transferId ? `${path}?id=${encodeURIComponent(transferId)}` : path;
  if (`${window.location.pathname}${window.location.search}` === next) {
    return;
  }
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }
}

export default function App() {
  const initial = readRoute();
  const [session, setSession] = useState<MeResponse | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inventory, setInventory] = useState<StoreInventoryResponse | null>(null);
  const [forecasts, setForecasts] = useState<Record<string, ForecastResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState<RequestOptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<MyTransfersResponse | null>(null);
  const [view, setView] = useState<HomeView>(initial.view);
  const [responding, setResponding] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(initial.transferId);
  const [transferDetail, setTransferDetail] = useState<TransferDetail | null>(null);
  const [loadingTransferDetail, setLoadingTransferDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const retry = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  const loadTransferDetail = useCallback((transferId: string) => {
    setSelectedTransferId(transferId);
    setDetailError(null);
    setLoadingTransferDetail(true);
    fetchTransferDetail(transferId)
      .then(setTransferDetail)
      .catch((err: Error) => {
        setDetailError(err.message);
        setSelectedTransferId(null);
        setTransferDetail(null);
        // Drop stale ?id= so the tab list remains usable.
        writeRoute(pathToView(window.location.pathname), null, true);
      })
      .finally(() => setLoadingTransferDetail(false));
  }, []);

  const clearTransferDetail = useCallback(() => {
    setSelectedTransferId(null);
    setTransferDetail(null);
    setDetailError(null);
  }, []);

  const applyRoute = useCallback(
    (nextView: HomeView, transferId: string | null) => {
      setView(nextView);
      if (transferId) {
        loadTransferDetail(transferId);
      } else {
        clearTransferDetail();
      }
    },
    [clearTransferDetail, loadTransferDetail],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    setCheckingSession(true);
    fetchMe()
      .then((me) => setSession(me))
      .catch(() => {
        clearToken();
        setSession(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!session) {
      setInventory(null);
      setForecasts({});
      setTransfers(null);
      return;
    }
    setError(null);
    setLoadingInventory(true);
    Promise.all([
      fetchStoreInventory(session.store_id),
      fetchStoreForecasts(session.store_id),
      fetchMyTransfers(),
    ])
      .then(([stock, forecastPayload, transferPayload]) => {
        setInventory(stock);
        const byProduct: Record<string, ForecastResponse> = {};
        for (const row of forecastPayload.forecasts) {
          byProduct[row.product_id] = row;
        }
        setForecasts(byProduct);
        setTransfers(transferPayload);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingInventory(false));
  }, [session, reloadKey]);

  useEffect(() => {
    if (!session) return;
    const { view: routeView, transferId } = readRoute();
    applyRoute(routeView, transferId);
  }, [session, applyRoute]);

  useEffect(() => {
    if (!session) return;
    const onPop = () => {
      const { view: routeView, transferId } = readRoute();
      applyRoute(routeView, transferId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [session, applyRoute]);

  function handleLogin(username: string, password: string) {
    setLoginError(null);
    setSubmitting(true);
    login(username, password)
      .then((payload) => {
        setToken(payload.token);
        writeRoute("inventory");
        setView("inventory");
        clearTransferDetail();
        setSession({
          store_id: payload.store_id,
          store_name: payload.store_name,
          username: payload.username,
        });
      })
      .catch(() => setLoginError("Invalid username or password"))
      .finally(() => setSubmitting(false));
  }

  function handleLogout() {
    clearToken();
    setSession(null);
    setInventory(null);
    setForecasts({});
    setError(null);
    setLoginError(null);
    setOptions(null);
    setOptionsError(null);
    setSendError(null);
    setTransfers(null);
    writeRoute("inventory");
    setView("inventory");
    clearTransferDetail();
  }

  function handleRequestProduct(productId: string) {
    setOptionsError(null);
    setSendError(null);
    setOptions(null);
    setLoadingOptions(true);
    fetchRequestOptions(productId)
      .then(setOptions)
      .catch((err: Error) => setOptionsError(err.message))
      .finally(() => setLoadingOptions(false));
  }

  function handleRespond(transferId: string, action: RespondAction, qty?: number) {
    setRespondError(null);
    setResponding(transferId);
    respondToTransfer(transferId, action, qty)
      .then(() => setReloadKey((key) => key + 1))
      .catch((err: Error) => setRespondError(err.message))
      .finally(() => setResponding(null));
  }

  function handleDispatch(transferId: string) {
    setDispatchError(null);
    setDispatching(transferId);
    dispatchTransfer(transferId)
      .then(() => setReloadKey((key) => key + 1))
      .catch((err: Error) => setDispatchError(err.message))
      .finally(() => setDispatching(null));
  }

  function handleSendTransfer(storeIds: string[]) {
    if (!options) {
      return;
    }
    setSendError(null);
    setSending(true);
    createTransfer(options.product_id, storeIds)
      .then(() => {
        setOptions(null);
        writeRoute("transferred");
        setView("transferred");
        clearTransferDetail();
        setReloadKey((key) => key + 1);
      })
      .catch((err: Error) => setSendError(err.message))
      .finally(() => setSending(false));
  }

  function handleOpenTransfer(transferId: string) {
    writeRoute(view === "inventory" ? "transferred" : view, transferId);
    loadTransferDetail(transferId);
  }

  function handleCloseTransferDetail() {
    writeRoute(view);
    clearTransferDetail();
  }

  function handleChangeView(nextView: HomeView) {
    writeRoute(nextView);
    setView(nextView);
    clearTransferDetail();
  }

  function handleTrackShipment(transferId: string) {
    writeRoute("in_transit", transferId);
    applyRoute("in_transit", transferId);
  }

  if (checkingSession) {
    return (
      <div className="shell">
        <header>
          <h1>Stoqvia</h1>
        </header>
        <LoadingState message="Checking session…" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell">
        <header>
          <h1>Stoqvia</h1>
          <p>Sign in to your store</p>
        </header>
        <LoginForm error={loginError} submitting={submitting} onSubmit={handleLogin} />
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="app-header">
        <div>
          <h1>Stoqvia</h1>
        </div>
        <button className="ghost-button" type="button" onClick={handleLogout}>
          Log out
        </button>
      </header>
      {renderHome(session)}
      {loadingOptions ? (
        <div className="modal-backdrop">
          <section className="panel modal-card">
            <LoadingState message="Loading options…" />
          </section>
        </div>
      ) : null}
      {optionsError ? (
        <div className="modal-backdrop" onClick={() => setOptionsError(null)} role="presentation">
          <section className="panel modal-card" onClick={(event) => event.stopPropagation()}>
            <p className="error">{optionsError}</p>
            <button className="ghost-button" type="button" onClick={() => setOptionsError(null)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
      {options ? (
        <RequestOptionsModal
          options={options}
          sending={sending}
          sendError={sendError}
          onClose={() => setOptions(null)}
          onSend={handleSendTransfer}
        />
      ) : null}
    </div>
  );

  function renderHome(current: MeResponse) {
    const incoming = transfers?.incoming ?? [];
    const outgoing = transfers?.outgoing ?? [];
    const receivedCount = incoming.filter((r) => ["PENDING", "CHECKING"].includes(r.my_status)).length;
    const acceptedCount = incoming.filter((r) => r.my_status === "ACCEPTED").length;
    const inTransitCount =
      outgoing.filter((r) => r.status === "IN_TRANSIT").length +
      incoming.filter((r) => r.status === "IN_TRANSIT" && r.my_status === "ACCEPTED").length;
    const declinedCount = outgoing.filter((r) => r.status === "DECLINED").length;

    const nav = (
      <StoreNav
        session={current}
        view={view}
        receivedCount={receivedCount}
        acceptedCount={acceptedCount}
        inTransitCount={inTransitCount}
        declinedCount={declinedCount}
        outgoingCount={outgoing.length}
        onChangeView={handleChangeView}
      />
    );

    if (error) {
      return (
        <div className="layout">
          {nav}
          <LoadError message={error} onRetry={retry} />
        </div>
      );
    }
    if (loadingInventory || !inventory) {
      return (
        <div className="layout">
          {nav}
          <section className="panel">
            <LoadingState message="Loading…" />
          </section>
        </div>
      );
    }

    let main = (
      <InventoryTable
        inventory={inventory}
        forecasts={forecasts}
        activeByProduct={buildActiveFulfillments(outgoing)}
        onRequestProduct={handleRequestProduct}
        onTrackShipment={handleTrackShipment}
      />
    );

    if (view !== "inventory" || selectedTransferId) {
      const errorBanner =
        respondError || dispatchError || detailError ? (
          <p className="error" style={{ margin: "0 0 8px" }}>
            {respondError ?? dispatchError ?? detailError}
          </p>
        ) : null;
      main = (
        <>
          {errorBanner}
          <TransferTables
            mode={view === "inventory" ? "transferred" : view}
            outgoing={outgoing}
            incoming={incoming}
            myStoreId={current.store_id}
            responding={responding}
            dispatching={dispatching}
            onRespond={handleRespond}
            onDispatch={handleDispatch}
            onOpenTransfer={handleOpenTransfer}
            selectedTransferId={selectedTransferId}
            transferDetail={transferDetail}
            loadingTransferDetail={loadingTransferDetail}
            onCloseTransferDetail={handleCloseTransferDetail}
          />
        </>
      );
    }

    return (
      <div className="layout">
        {nav}
        {main}
      </div>
    );
  }
}
