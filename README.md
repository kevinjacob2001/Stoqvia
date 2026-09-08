# Stoqvia

AI-powered inventory risk detection and inter-store fulfilment coordination for multi-store retailers.

Stoqvia is a shared coordination layer for store teams. It brings demand-based risk detection, donor-store discovery, request broadcasting, stock verification, transfer tracking, and supplier fallback into one governed workflow, so employees spend less time on calls and more time on the shop floor.

## Product overview

Stoqvia is an inventory coordination product for multi-store retail networks. Store administrators log in to their own store, see which products are at risk over the next seven days, and raise a single fulfilment request instead of ringing neighbouring stores one by one.

It is designed for store managers and inventory coordinators who already know the operational problem: stock is fragmented across locations, shortage checks are slow, and the same request is explained repeatedly. Stoqvia connects four parts of that job: **prediction** (7-day demand and risk), **coordination** (broadcast requests and store responses), **fulfilment** (dispatch, in-transit tracking, and completion), and **automation** (due transfers complete without a manual chase).

The current repository is a working four-store Adelaide demonstration (Adelaide CBD, Marion, Mile End, and Modbury) with a React store console, a FastAPI backend, MongoDB, a LightGBM demand model, and a read-only Copilot over local Ollama.

