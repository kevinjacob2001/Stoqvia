import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import { BrandLockup, Button, SiteFooter } from "./components/ui/index.ts";
import { CreateRequestPage } from "./features/createRequest/index.ts";
import { ProductsPage } from "./features/products/index.ts";
import { RequestsPage } from "./features/requests/index.ts";
import { AppShell } from "./layout/index.ts";
import { buildActiveFulfillments } from "./lib/fulfillments.ts";
import { pathToView, readRoute, writeRoute, documentTitleFor, type HomeView } from "./lib/routes.ts";
import { transferNavStats } from "./lib/transferCounts.ts";
import LoadError from "./sections/LoadError/index.ts";
import LoadingState from "./sections/LoadingState/index.ts";
import LoginForm from "./sections/LoginForm/index.ts";
import TransferTables, { type TransferListMode } from "./sections/TransferTables/index.ts";
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
        writeRoute(pathToView(window.location.pathname), { replace: true });
      })
      .finally(() => setLoadingTransferDetail(false));
  }, []);

  const clearTransferDetail = useCallback(() => {
    setSelectedTransferId(null);
    setTransferDetail(null);
    setDetailError(null);
  }, []);

  const applyRoute = useCallback(
    (nextView: HomeView, transferId: string | null, productId: string | null = null) => {
      setView(nextView);
      if (transferId) {
        loadTransferDetail(transferId);
      } else {
        clearTransferDetail();
      }
      if (nextView === "create_request" && productId) {
        setOptionsError(null);
        setSendError(null);
        setLoadingOptions(true);
        fetchRequestOptions(productId)
          .then(setOptions)
          .catch((err: Error) => {
            setOptions(null);
            setOptionsError(err.message);
          })
          .finally(() => setLoadingOptions(false));
      } else if (nextView !== "create_request") {
        setOptions(null);
        setOptionsError(null);
        setSendError(null);
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
    if (!session) {
      document.title = "Stoqvia";
      return;
    }
    document.title = documentTitleFor(view, { detail: Boolean(selectedTransferId) });
  }, [session, view, selectedTransferId]);

  useEffect(() => {
    if (!session) return;
    const { view: routeView, transferId, productId } = readRoute();
    applyRoute(routeView, transferId, productId);
  }, [session, applyRoute]);

  useEffect(() => {
    if (!session) return;
    const onPop = () => {
      const { view: routeView, transferId, productId } = readRoute();
      applyRoute(routeView, transferId, productId);
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
    writeRoute("create_request", { productId });
    applyRoute("create_request", null, productId);
  }

  function handleCancelCreateRequest() {
    setOptions(null);
    setOptionsError(null);
    setSendError(null);
    writeRoute("inventory");
    setView("inventory");
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

  function handleSendTransfer(storeIds: string[], qty: number) {
    if (!options) {
      return;
    }
    setSendError(null);
    setSending(true);
    createTransfer(options.product_id, storeIds, qty)
      .then(() => {
        setOptions(null);
        writeRoute("requests");
        setView("requests");
        clearTransferDetail();
        setReloadKey((key) => key + 1);
      })
      .catch((err: Error) => setSendError(err.message))
      .finally(() => setSending(false));
  }

  function handleOpenTransfer(transferId: string) {
    const nextView = view === "inventory" || view === "create_request" ? "requests" : view;
    writeRoute(nextView, { transferId });
    loadTransferDetail(transferId);
    setView(nextView);
  }

  function handleCloseTransferDetail() {
    writeRoute(view);
    clearTransferDetail();
  }

  function handleChangeView(nextView: HomeView) {
    writeRoute(nextView);
    setView(nextView);
    clearTransferDetail();
    if (nextView !== "create_request") {
      setOptions(null);
      setOptionsError(null);
      setSendError(null);
    }
  }

  function handleTrackShipment(transferId: string) {
    writeRoute("in_transit", { transferId });
    applyRoute("in_transit", transferId, null);
  }

  function handleTrackProductStatus(transferId: string) {
    const row = transfers?.outgoing.find((item) => item.transfer_id === transferId);
    if (row?.status === "IN_TRANSIT") {
      handleTrackShipment(transferId);
      return;
    }
    writeRoute("transferred", { transferId });
    loadTransferDetail(transferId);
    setView("transferred");
  }

  if (checkingSession) {
    return (
      <div className="login-page">
        <div className="login-card">
          <header className="login-brand">
            <BrandLockup tone="light" size="lg" />
          </header>
          <LoadingState message="Checking session…" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">
          <header className="login-brand">
            <BrandLockup tone="light" size="lg" />
            <p>Inter-store inventory transfer for Bunnings stores</p>
          </header>
          <LoginForm error={loginError} submitting={submitting} onSubmit={handleLogin} />
        </div>
        <SiteFooter />
      </div>
    );
  }

  const incoming = transfers?.incoming ?? [];
  const outgoing = transfers?.outgoing ?? [];
  const counts = transferNavStats(incoming, outgoing);
  const alertCount = Object.values(forecasts).filter((f) => f.risk === "HIGH").length;

  let mainContent: ReactNode;
  if (error) {
    mainContent = <LoadError message={error} onRetry={retry} />;
  } else if (loadingInventory || !inventory) {
    mainContent = (
      <section className="panel">
        <LoadingState message="Loading…" />
      </section>
    );
  } else if (view === "create_request") {
    if (loadingOptions) {
      mainContent = (
        <section className="panel">
          <LoadingState message="Loading request options…" />
        </section>
      );
    } else if (optionsError) {
      mainContent = (
        <section className="panel">
          <p className="error">{optionsError}</p>
          <Button onClick={handleCancelCreateRequest}>Back to Products</Button>
        </section>
      );
    } else if (options) {
      const item = inventory.items.find((row) => row.product_id === options.product_id);
      mainContent = (
        <CreateRequestPage
          options={options}
          inventoryItem={item}
          sending={sending}
          sendError={sendError}
          onCancel={handleCancelCreateRequest}
          onBroadcast={handleSendTransfer}
        />
      );
    } else {
      mainContent = (
        <section className="panel">
          <p className="status">No request loaded.</p>
          <Button onClick={handleCancelCreateRequest}>Back to Products</Button>
        </section>
      );
    }
  } else if (view !== "inventory" || selectedTransferId) {
    const errorBanner =
      respondError || dispatchError || detailError ? (
        <p className="error" style={{ margin: "0 0 8px" }}>
          {respondError ?? dispatchError ?? detailError}
        </p>
      ) : null;
    const isRequestsView = view === "requests" || view === "received" || view === "transferred";
    const showingDetail = Boolean(selectedTransferId && (loadingTransferDetail || transferDetail || detailError));
    if (isRequestsView && !showingDetail) {
      const mode = view === "received" ? "received" : view === "transferred" ? "sent" : "overview";
      mainContent = (
        <>
          {errorBanner}
          <RequestsPage
            mode={mode}
            incoming={incoming}
            outgoing={outgoing}
            responding={responding}
            onRespond={handleRespond}
            onOpenTransfer={handleOpenTransfer}
            onViewAllReceived={() => handleChangeView("received")}
            onViewAllSent={() => handleChangeView("transferred")}
            onNavigate={handleChangeView}
          />
        </>
      );
    } else {
      const listMode: TransferListMode =
        view === "accepted" || view === "in_transit" || view === "declined" ? view : "accepted";
      mainContent = (
        <>
          {errorBanner}
          <TransferTables
            mode={listMode}
            view={view}
            outgoing={outgoing}
            incoming={incoming}
            dispatching={dispatching}
            onDispatch={handleDispatch}
            onOpenTransfer={handleOpenTransfer}
            selectedTransferId={selectedTransferId}
            transferDetail={transferDetail}
            loadingTransferDetail={loadingTransferDetail}
            onCloseTransferDetail={handleCloseTransferDetail}
            onNavigate={handleChangeView}
          />
        </>
      );
    }
  } else {
    mainContent = (
      <ProductsPage
        inventory={inventory}
        forecasts={forecasts}
        activeByProduct={buildActiveFulfillments(outgoing)}
        onRequestProduct={handleRequestProduct}
        onTrackShipment={handleTrackProductStatus}
      />
    );
  }

  return (
    <AppShell
      session={session}
      view={view}
      counts={{
        ...counts,
        alertCount,
      }}
      selectedProductId={options?.product_id ?? null}
      onChangeView={handleChangeView}
      onLogout={handleLogout}
      onSelectProduct={handleRequestProduct}
    >
      {mainContent}
    </AppShell>
  );
}
