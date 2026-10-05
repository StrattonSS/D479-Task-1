(() => {
    const nav = document.querySelector("header nav");
    const toggle = nav?.querySelector(".nav-toggle");
    const links = nav?.querySelectorAll(".nav-links a");

    if (nav && toggle) {
        const closeMenu = () => {
            nav.classList.remove("menu-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open navigation menu");
        };

        toggle.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("menu-open");
            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        });

        links?.forEach((link) => link.addEventListener("click", closeMenu));

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && nav.classList.contains("menu-open")) {
                closeMenu();
                toggle.focus();
            }
        });
    }

    document.querySelectorAll("[data-attraction-dialog]").forEach((trigger) => {
        const dialog = document.getElementById(trigger.dataset.attractionDialog);
        const closeButton = dialog?.querySelector(".dialog-close");

        if (!dialog) {
            return;
        }

        trigger.addEventListener("click", () => dialog.showModal());
        closeButton?.addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                dialog.close();
            }
        });
    });

    const detailsForm = document.querySelector("#trip-details");
    if (!detailsForm) {
        return;
    }

    const storageKey = "taniti-trip-itinerary-v1";
    const arrivalInput = document.querySelector("#arrival-date");
    const departureInput = document.querySelector("#departure-date");
    const travelerInput = document.querySelector("#traveler-count");
    const originInput = document.querySelector("#origin");
    const optionButtons = document.querySelectorAll(".option-button");
    const dateStatus = document.querySelector("#date-status");
    const summaryStatus = document.querySelector("#summary-status");
    const reviewDialog = document.querySelector("#review-dialog");

    function formatDateInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    function initialState() {
        const arrival = addDays(new Date(), 30);
        return {
            origin: "Honolulu (HNL)",
            arrival: formatDateInput(arrival),
            departure: formatDateInput(addDays(arrival, 7)),
            travelers: 2,
            selections: {
                flight: null,
                stay: null,
                car: null,
                dining: [],
                experience: []
            }
        };
    }

    function loadState() {
        const freshState = initialState();

        try {
            const savedState = JSON.parse(localStorage.getItem(storageKey));
            if (!savedState || typeof savedState !== "object") {
                return freshState;
            }

            const savedSelections = savedState.selections || {};
            return {
                origin: typeof savedState.origin === "string" ? savedState.origin : freshState.origin,
                arrival: typeof savedState.arrival === "string" ? savedState.arrival : freshState.arrival,
                departure: typeof savedState.departure === "string" ? savedState.departure : freshState.departure,
                travelers: Math.min(6, Math.max(1, Number(savedState.travelers) || freshState.travelers)),
                selections: {
                    flight: savedSelections.flight || null,
                    stay: savedSelections.stay || null,
                    car: savedSelections.car || null,
                    dining: Array.isArray(savedSelections.dining) ? savedSelections.dining : [],
                    experience: Array.isArray(savedSelections.experience) ? savedSelections.experience : []
                }
            };
        } catch {
            return freshState;
        }
    }

    const state = loadState();

    function getNights() {
        if (!state.arrival || !state.departure) {
            return 0;
        }

        const arrival = new Date(`${state.arrival}T12:00:00`);
        const departure = new Date(`${state.departure}T12:00:00`);
        return Math.max(0, Math.round((departure - arrival) / 86400000));
    }

    function formatDate(dateString) {
        if (!dateString) {
            return "Choose your dates";
        }

        return new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(new Date(`${dateString}T12:00:00`));
    }

    function formatMoney(amount) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }).format(amount);
    }

    function allSelections() {
        return [
            state.selections.flight,
            state.selections.stay,
            state.selections.car,
            ...state.selections.dining,
            ...state.selections.experience
        ].filter(Boolean);
    }

    function itemTotal(item) {
        const multiplier = item.rate === "person"
            ? state.travelers
            : item.rate === "night" || item.rate === "day"
                ? getNights()
                : 1;
        return Number(item.price) * multiplier;
    }

    function itemFromButton(button) {
        const timeInput = button.closest(".option-card")?.querySelector("[data-reservation-time]");
        return {
            id: button.dataset.id,
            kind: button.dataset.kind,
            name: button.dataset.name,
            detail: button.dataset.detail,
            price: Number(button.dataset.price),
            rate: button.dataset.rate,
            time: timeInput?.value || ""
        };
    }

    function saveState() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
            summaryStatus.textContent = "Itinerary saved on this device.";
        } catch {
            summaryStatus.textContent = "This browser could not save the itinerary.";
        }
    }

    function renderButtons() {
        optionButtons.forEach((button) => {
            const { kind, id } = button.dataset;
            const selectedItems = Array.isArray(state.selections[kind])
                ? state.selections[kind]
                : [state.selections[kind]].filter(Boolean);
            const isSelected = selectedItems.some((item) => item.id === id);
            const actionLabels = {
                flight: "Choose flight",
                stay: "Choose stay",
                car: "Choose car",
                dining: "Add dinner idea",
                experience: "Add experience"
            };

            button.setAttribute("aria-pressed", String(isSelected));
            button.classList.toggle("is-selected", isSelected);
            button.textContent = isSelected
                ? kind === "dining" || kind === "experience" ? "Added to itinerary" : "Selected · remove"
                : actionLabels[kind];
        });
    }

    function renderSummary() {
        const nights = getNights();
        const selectionList = document.querySelector("#summary-items");
        const selected = allSelections();
        const total = selected.reduce((sum, item) => sum + itemTotal(item), 0);

        document.querySelector("#summary-dates").textContent = state.arrival && state.departure
            ? `${formatDate(state.arrival)} – ${formatDate(state.departure)}`
            : "Choose your dates";
        document.querySelector("#summary-travelers").textContent = `${state.travelers} ${state.travelers === 1 ? "traveler" : "travelers"}`;
        document.querySelector("#flight-origin").textContent = state.origin || "Your airport";
        document.querySelector("#flight-date-range").textContent = state.arrival && state.departure
            ? `${formatDate(state.arrival)} – ${formatDate(state.departure)}`
            : "Set travel dates above";
        document.querySelector("#stay-night-count").textContent = nights
            ? `${nights} ${nights === 1 ? "night" : "nights"}`
            : "Set travel dates above";
        document.querySelector("#summary-empty").hidden = selected.length > 0;
        document.querySelector("#summary-total").textContent = formatMoney(total);
        document.querySelector("#review-trip").disabled = selected.length === 0;

        selectionList.replaceChildren();
        selected.forEach((item) => {
            const listItem = document.createElement("li");
            listItem.className = "summary-item";

            const text = document.createElement("div");
            const name = document.createElement("strong");
            const detail = document.createElement("span");
            const price = document.createElement("span");
            name.textContent = item.name;
            detail.textContent = item.time ? `${item.detail} · ${item.time}` : item.detail;
            price.textContent = formatMoney(itemTotal(item));
            text.append(name, detail);
            listItem.append(text, price);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-selection";
            removeButton.dataset.removeKind = item.kind;
            removeButton.dataset.removeId = item.id;
            removeButton.setAttribute("aria-label", `Remove ${item.name}`);
            removeButton.textContent = "×";
            listItem.append(removeButton);
            selectionList.append(listItem);
        });

        renderButtons();
    }

    function persistAndRender() {
        saveState();
        renderSummary();
    }

    function updateDateLimits() {
        const arrival = arrivalInput.value;
        if (!arrival) {
            return;
        }

        const nextDay = addDays(new Date(`${arrival}T12:00:00`), 1);
        departureInput.min = formatDateInput(nextDay);
        if (departureInput.value && departureInput.value < departureInput.min) {
            departureInput.value = departureInput.min;
            state.departure = departureInput.value;
        }
    }

    arrivalInput.min = formatDateInput(new Date());
    arrivalInput.value = state.arrival;
    departureInput.value = state.departure;
    originInput.value = state.origin;
    travelerInput.value = String(state.travelers);
    updateDateLimits();
    renderSummary();

    arrivalInput.addEventListener("change", () => {
        state.arrival = arrivalInput.value;
        updateDateLimits();
        persistAndRender();
    });

    departureInput.addEventListener("change", () => {
        state.departure = departureInput.value;
        persistAndRender();
    });

    travelerInput.addEventListener("change", () => {
        state.travelers = Number(travelerInput.value);
        persistAndRender();
    });

    originInput.addEventListener("input", () => {
        state.origin = originInput.value.trim();
        renderSummary();
    });

    detailsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        state.origin = originInput.value.trim() || "Your airport";
        state.arrival = arrivalInput.value;
        state.departure = departureInput.value;
        state.travelers = Number(travelerInput.value);
        dateStatus.textContent = `${getNights()} ${getNights() === 1 ? "night" : "nights"} planned · estimates updated below.`;
        persistAndRender();
    });

    optionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const item = itemFromButton(button);
            const { kind } = item;
            if (kind === "dining" || kind === "experience") {
                const items = state.selections[kind];
                const existingIndex = items.findIndex((selection) => selection.id === item.id);
                if (existingIndex >= 0) {
                    items.splice(existingIndex, 1);
                } else {
                    items.push(item);
                }
            } else {
                state.selections[kind] = state.selections[kind]?.id === item.id ? null : item;
            }
            persistAndRender();
        });
    });

    document.querySelector("#summary-items").addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-kind]");
        if (!button) {
            return;
        }

        const { removeKind, removeId } = button.dataset;
        if (removeKind === "dining" || removeKind === "experience") {
            state.selections[removeKind] = state.selections[removeKind].filter((item) => item.id !== removeId);
        } else if (state.selections[removeKind]?.id === removeId) {
            state.selections[removeKind] = null;
        }
        persistAndRender();
    });

    document.querySelector("#clear-trip").addEventListener("click", () => {
        state.selections = { flight: null, stay: null, car: null, dining: [], experience: [] };
        persistAndRender();
        summaryStatus.textContent = "Selections cleared. Your travel details are still saved.";
    });

    document.querySelector("#review-trip").addEventListener("click", () => {
        const reviewItems = document.querySelector("#review-items");
        reviewItems.replaceChildren();
        allSelections().forEach((item) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${item.name}${item.time ? ` · ${item.time}` : ""} — ${formatMoney(itemTotal(item))}`;
            reviewItems.append(listItem);
        });

        document.querySelector("#review-dates").textContent = `${formatDate(state.arrival)} – ${formatDate(state.departure)} · ${state.travelers} ${state.travelers === 1 ? "traveler" : "travelers"} · estimated total ${formatMoney(allSelections().reduce((sum, item) => sum + itemTotal(item), 0))}`;
        reviewDialog.showModal();
    });

    document.querySelector("#close-review").addEventListener("click", () => reviewDialog.close());
    document.querySelector("#print-itinerary").addEventListener("click", () => window.print());
})();