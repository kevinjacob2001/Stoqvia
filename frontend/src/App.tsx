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
import InventoryTable from "./sections/InventoryTable.tsx";
import LoadError from "./sections/LoadError.tsx";
import LoadingState from "./sections/LoadingState.tsx";
import LoginForm from "./sections/LoginForm.tsx";
import RequestOptionsModal from "./sections/RequestOptionsModal.tsx";
import StoreNav, { type HomeView } from "./sections/StoreNav.tsx";
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

export default function App() {
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
  const [view, setView] = useState<HomeView>("inventory");
  const [responding, setResponding] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [transferDetail, setTransferDetail] = useState<TransferDetail | null>(null);
  const [loadingTransferDetail, setLoadingTransferDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const retry = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

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

  function handleLogin(username: string, password: string) {
    setLoginError(null);
    setSubmitting(true);
    login(username, password)
      .then((payload) => {
        setToken(payload.token);
        setView("inventory");
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
    setView("inventory");
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

  function handleRespond(transferId: string, action: RespondAction) {
    setRespondError(null);
    setResponding(transferId);
    respondToTransfer(transferId, action)
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
        setView("transferred");
        setReloadKey((key) => key + 1);
      })
      .catch((err: Error) => setSendError(err.message))
      .finally(() => setSending(false));
  }

  function getTransferIdFromPath(): string | null {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "transfers") return parts[1];
    return null;
  }

  function setTransferRoute(transferId: string | null) {
    const nextPath = transferId ? `/transfers/${transferId}` : "/";
    window.history.pushState({}, "", nextPath);
  }

  function handleOpenTransfer(transferId: string, syncUrl: boolean = true) {
    if (syncUrl) setTransferRoute(transferId);
    setSelectedTransferId(transferId);
    setDetailError(null);
    setLoadingTransferDetail(true);
    fetchTransferDetail(transferId)
      .then(setTransferDetail)
      .catch((err: Error) => setDetailError(err.message))
      .finally(() => setLoadingTransferDetail(false));
  }

  function handleCloseTransferDetail(syncUrl: boolean = true) {
    if (syncUrl) setTransferRoute(null);
    setSelectedTransferId(null);
    setTransferDetail(null);
    setDetailError(null);
  }

  function handleChangeView(nextView: HomeView) {
    handleCloseTransferDetail();
    setView(nextView);
  }

  useEffect(() => {
    if (!session) return;
    const transferId = getTransferIdFromPath();
    if (transferId) {
      if (transferId !== selectedTransferId) handleOpenTransfer(transferId, false);
    } else if (selectedTransferId) {
      handleCloseTransferDetail(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const onPop = () => {
      const transferId = getTransferIdFromPath();
      if (transferId) handleOpenTransfer(transferId, false);
      else handleCloseTransferDetail(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, selectedTransferId]);

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
    const acceptedCount = incoming.filter(
      (r) => r.my_status === "ACCEPTED" && ["FULFILLED", "IN_TRANSIT"].includes(r.status),
    ).length;
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
        onRequestProduct={handleRequestProduct}
      />
    );
    if (selectedTransferId) {
      const errorBanner =
        detailError || respondError || dispatchError ? (
          <p className="error" style={{ margin: "0 0 8px" }}>
            {detailError ?? respondError ?? dispatchError}
          </p>
        ) : null;
      main = (
        <>
          {errorBanner}
          <TransferTables
            mode={view}
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
    if (view !== "inventory") {
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
            mode={view}
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
