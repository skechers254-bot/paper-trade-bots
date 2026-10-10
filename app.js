(() => {
  const STORAGE_KEY = "signal-desk-demo-v1";
  const INITIAL_CASH = 25000;
  const assets = [
    { symbol: "BTC", name: "Bitcoin", mark: "₿", price: 67420, change: 2.18, volume: 124.8, tone: "bitcoin" },
    { symbol: "ETH", name: "Ethereum", mark: "◆", price: 3520, change: 1.42, volume: 68.3, tone: "ethereum" },
    { symbol: "SOL", name: "Solana", mark: "◎", price: 148.6, change: -0.86, volume: 31.6, tone: "solana" },
  ];
  const defaultBots = [
    { id: "range", name: "Range watch", mode: "BTC · range", pnl: 18.4, running: false },
    { id: "momentum", name: "Momentum scout", mode: "ETH · trend", pnl: -6.2, running: false },
    { id: "mean", name: "Mean return", mode: "SOL · mean", pnl: 11.7, running: false },
  ];
  const ranges = {
    "1H": { labels: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"], spread: 190, points: 52 },
    "24H": { labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"], spread: 680, points: 68 },
    "7D": { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], spread: 1420, points: 74 },
    "30D": { labels: ["Sep 12", "Sep 18", "Sep 24", "Sep 30", "Oct 6", "Oct 11"], spread: 2750, points: 78 },
  };

  const nodes = {
    portfolioValue: document.querySelector("#portfolio-value"),
    portfolioChange: document.querySelector("#portfolio-change"),
    cashValue: document.querySelector("#cash-value"),
    positionCount: document.querySelector("#position-count"),
    runningCount: document.querySelector("#running-count"),
    botState: document.querySelector("#bot-state-label"),
    marketRows: document.querySelector("#market-rows"),
    activityRows: document.querySelector("#activity-rows"),
    activityEmpty: document.querySelector("#activity-empty"),
    botList: document.querySelector("#bot-list"),
    selectedPrice: document.querySelector("#selected-price"),
    selectedChange: document.querySelector("#selected-change"),
    selectedName: document.querySelector("#chart-title"),
    coinMark: document.querySelector("#coin-mark"),
    assetSelect: document.querySelector("#ticket-asset"),
    amount: document.querySelector("#ticket-amount"),
    estimatedQuantity: document.querySelector("#estimated-quantity"),
    ticketBalance: document.querySelector("#ticket-balance"),
    feedback: document.querySelector("#order-feedback"),
    submitOrder: document.querySelector("#submit-order"),
    toast: document.querySelector("#toast"),
    chartLine: document.querySelector("#chart-line"),
    chartArea: document.querySelector("#chart-area"),
    chartLabels: document.querySelector("#chart-x-labels"),
    sequence: document.querySelector("#ticket-sequence"),
  };

  let state = loadState();
  let selectedSymbol = "BTC";
  let side = "buy";
  let currentRange = "1H";
  let toastTimer;
  let chartValues = [];

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved.cash !== "number" || !saved.holdings || !Array.isArray(saved.bots) || !Array.isArray(saved.activity)) {
        return freshState();
      }
      return {
        cash: Math.max(0, saved.cash),
        holdings: saved.holdings,
        bots: saved.bots.map((bot, index) => ({
          id: String(bot.id || `bot-${index}`),
          name: String(bot.name || "Sample strategy"),
          mode: String(bot.mode || "Demo rules"),
          pnl: Number.isFinite(bot.pnl) ? bot.pnl : 0,
          running: Boolean(bot.running),
        })),
        activity: saved.activity.filter((item) => item && typeof item === "object").slice(0, 12),
        nextOrder: Number.isInteger(saved.nextOrder) ? Math.max(1, saved.nextOrder) : 1,
      };
    } catch (error) {
      console.error("Could not load saved demo portfolio.", error);
      return freshState();
    }
  }

  function freshState() {
    return {
      cash: INITIAL_CASH,
      holdings: {},
      bots: defaultBots.map((bot) => ({ ...bot })),
      activity: [],
      nextOrder: 1,
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save demo portfolio.", error);
      showToast("This browser could not save the demo session. Changes may not persist after closing.");
    }
  }

  function money(value, digits = 2) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }

  function quantity(value) {
    if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }

  function selectedAsset() {
    return assets.find((asset) => asset.symbol === selectedSymbol) || assets[0];
  }

  function portfolioValue() {
    return state.cash + assets.reduce((sum, asset) => sum + (state.holdings[asset.symbol] || 0) * asset.price, 0);
  }

  function holdingsCount() {
    return assets.filter((asset) => (state.holdings[asset.symbol] || 0) > 0.00000001).length;
  }

  function renderSummary() {
    const value = portfolioValue();
    const change = value - INITIAL_CASH;
    nodes.portfolioValue.textContent = money(value);
    nodes.portfolioChange.classList.toggle("positive", change >= 0);
    nodes.portfolioChange.classList.toggle("negative", change < 0);
    nodes.portfolioChange.innerHTML = `${change >= 0 ? "+" : "−"}${money(Math.abs(change))} <small>since start</small>`;
    nodes.cashValue.textContent = money(state.cash);
    nodes.ticketBalance.textContent = money(state.cash);
    nodes.positionCount.innerHTML = `${holdingsCount()} <small>assets</small>`;
    const running = state.bots.filter((bot) => bot.running).length;
    nodes.runningCount.innerHTML = `${running} <small>of ${state.bots.length}</small>`;
    nodes.botState.textContent = running ? `${running} running` : "All paused";
    nodes.botState.parentElement.classList.toggle("running", running > 0);
  }

  function renderMarkets() {
    nodes.marketRows.innerHTML = assets.map((asset) => {
      const selected = asset.symbol === selectedSymbol;
      const holding = state.holdings[asset.symbol] || 0;
      return `<tr class="market-row${selected ? " selected" : ""}" data-symbol="${asset.symbol}" tabindex="0" aria-label="Select ${asset.name}, ${money(asset.price)}">
        <td><div class="asset-cell"><span class="asset-icon ${asset.tone}" aria-hidden="true">${asset.mark}</span><span class="asset-name"><strong>${asset.name}</strong><small>${asset.symbol} · ${quantity(holding)} held</small></span></div></td>
        <td class="market-price">${money(asset.price, asset.price < 1000 ? 2 : 2)}</td>
        <td><span class="change-pill ${asset.change >= 0 ? "up" : "down"}">${asset.change > 0 ? "+" : ""}${asset.change.toFixed(2)}%</span></td>
        <td>$${asset.volume.toFixed(1)}M</td>
        <td><button class="row-select" type="button" data-select="${asset.symbol}" aria-label="Trade ${asset.symbol}">Trade</button></td>
      </tr>`;
    }).join("");
  }

  function renderAssetOptions() {
    nodes.assetSelect.innerHTML = assets.map((asset) =>
      `<option value="${asset.symbol}">${asset.name} (${asset.symbol}) · ${money(asset.price)}</option>`,
    ).join("");
    nodes.assetSelect.value = selectedSymbol;
  }

  function renderSelectedAsset() {
    const asset = selectedAsset();
    nodes.selectedName.innerHTML = `${asset.name} <span>${asset.symbol} / USD</span>`;
    nodes.coinMark.textContent = asset.mark;
    nodes.coinMark.className = `coin-mark ${asset.tone}`;
    nodes.selectedPrice.textContent = money(asset.price);
    nodes.selectedChange.textContent = `${asset.change > 0 ? "+" : ""}${asset.change.toFixed(2)}%`;
    nodes.selectedChange.classList.toggle("positive", asset.change >= 0);
    nodes.selectedChange.classList.toggle("negative", asset.change < 0);
    nodes.assetSelect.value = asset.symbol;
    renderEstimate();
    drawChart();
  }

  function renderEstimate() {
    const asset = selectedAsset();
    const amount = Number(nodes.amount.value);
    const estimated = Number.isFinite(amount) && amount > 0 ? amount / asset.price : 0;
    nodes.estimatedQuantity.textContent = `${quantity(estimated)} ${asset.symbol}`;
  }

  function renderBots() {
    nodes.botList.innerHTML = state.bots.map((bot) => {
      const resultClass = bot.pnl >= 0 ? "positive" : "negative";
      return `<div class="bot-row">
        <div>
          <div class="bot-name-line"><span class="bot-name">${escapeHtml(bot.name)}</span><span class="bot-mode">${escapeHtml(bot.mode)}</span></div>
          <div class="bot-details"><span>Demo P&amp;L</span><strong class="${resultClass}">${bot.pnl >= 0 ? "+" : "−"}${money(Math.abs(bot.pnl))}</strong></div>
        </div>
        <button class="bot-toggle${bot.running ? " is-running" : ""}" type="button" data-bot="${escapeHtml(bot.id)}" aria-pressed="${bot.running}">${bot.running ? "Pause" : "Start"}</button>
      </div>`;
    }).join("");
  }

  function renderActivity() {
    const activity = state.activity.slice(0, 8);
    nodes.activityEmpty.hidden = activity.length > 0;
    nodes.activityRows.innerHTML = activity.map((item) => {
      const isSell = item.side === "sell";
      return `<tr>
        <td><span class="activity-action"><span class="activity-icon${isSell ? " sell" : ""}">${isSell ? "↓" : "↑"}</span>${escapeHtml(item.action)}</span></td>
        <td>${escapeHtml(item.symbol)}</td>
        <td>${money(item.amount)}</td>
        <td><span class="status-badge">Simulated</span></td>
        <td>${escapeHtml(item.time)}</td>
      </tr>`;
    }).join("");
  }

  function render() {
    renderSummary();
    renderMarkets();
    renderBots();
    renderActivity();
    renderAssetOptions();
    renderSelectedAsset();
    nodes.sequence.textContent = `PASS ${String(state.nextOrder).padStart(3, "0")}`;
    document.querySelector("#ticket-balance").textContent = money(state.cash);
  }

  function drawChart() {
    const asset = selectedAsset();
    const config = ranges[currentRange];
    const base = asset.price;
    let seed = asset.symbol.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0) + config.points + config.spread;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    let value = base - config.spread * 0.16;
    chartValues = Array.from({ length: config.points }, (_, index) => {
      const wave = Math.sin(index / 5.7) * config.spread * 0.035;
      value += (random() - 0.47) * config.spread * 0.105 + wave * 0.06;
      return value;
    });
    chartValues[chartValues.length - 1] = base;
    const min = Math.min(...chartValues) - config.spread * 0.13;
    const max = Math.max(...chartValues) + config.spread * 0.13;
    const xLeft = 3;
    const xRight = 760;
    const yTop = 10;
    const yBottom = 207;
    const points = chartValues.map((price, index) => {
      const x = xLeft + (index / (chartValues.length - 1)) * (xRight - xLeft);
      const y = yBottom - ((price - min) / (max - min)) * (yBottom - yTop);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    nodes.chartLine.setAttribute("d", `M${points.join(" L")}`);
    nodes.chartArea.setAttribute("d", `M${xLeft},${yBottom} L${points.join(" L")} L${xRight},${yBottom} Z`);
    nodes.chartLabels.innerHTML = config.labels.map((label) => `<span>${label}</span>`).join("");
    const yLabels = document.querySelector(".chart-y-labels");
    const steps = [1, .75, .5, .25, 0];
    yLabels.innerHTML = steps.map((step, index) =>
      `<text x="795" y="${21 + index * 45}">${money(min + (max - min) * step, asset.price < 1000 ? 1 : 0)}</text>`,
    ).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function showToast(message) {
    nodes.toast.textContent = message;
    nodes.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => nodes.toast.classList.remove("visible"), 3200);
  }

  function updateClock() {
    const now = new Date();
    document.querySelector("#clock").textContent = `${now.toISOString().slice(11, 19)} UTC`;
  }

  function placeOrder() {
    const asset = selectedAsset();
    const amount = Number(nodes.amount.value);
    nodes.feedback.textContent = "";
    if (!Number.isFinite(amount) || amount < 1) {
      nodes.feedback.textContent = "Enter an order amount of at least $1.";
      nodes.amount.focus();
      return;
    }
    const units = amount / asset.price;
    if (side === "buy") {
      if (amount > state.cash) {
        nodes.feedback.textContent = "That exceeds your available demo cash.";
        nodes.amount.focus();
        return;
      }
      state.cash -= amount;
      state.holdings[asset.symbol] = (state.holdings[asset.symbol] || 0) + units;
    } else {
      const held = state.holdings[asset.symbol] || 0;
      if (units > held + 1e-10) {
        nodes.feedback.textContent = `You have only ${quantity(held)} ${asset.symbol} in this demo portfolio.`;
        nodes.amount.focus();
        return;
      }
      state.cash += amount;
      state.holdings[asset.symbol] = Math.max(0, held - units);
    }
    state.activity.unshift({
      action: side === "buy" ? "Paper buy" : "Paper sell",
      side,
      symbol: asset.symbol,
      amount,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    });
    state.nextOrder += 1;
    saveState();
    render();
    showToast(`${side === "buy" ? "Buy" : "Sell"} order simulated for ${money(amount)} of ${asset.symbol}.`);
  }

  nodes.marketRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select]");
    const row = event.target.closest(".market-row");
    const symbol = button?.dataset.select || row?.dataset.symbol;
    if (symbol) {
      selectedSymbol = symbol;
      renderMarkets();
      renderSelectedAsset();
    }
  });
  nodes.marketRows.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".market-row")) {
      event.preventDefault();
      selectedSymbol = event.target.dataset.symbol;
      renderMarkets();
      renderSelectedAsset();
    }
  });
  nodes.assetSelect.addEventListener("change", () => {
    selectedSymbol = nodes.assetSelect.value;
    renderMarkets();
    renderSelectedAsset();
  });
  nodes.amount.addEventListener("input", renderEstimate);
  nodes.submitOrder.addEventListener("click", placeOrder);
  nodes.amount.addEventListener("keydown", (event) => {
    if (event.key === "Enter") placeOrder();
  });

  document.querySelectorAll(".side-button").forEach((button) => {
    button.addEventListener("click", () => {
      side = button.dataset.side;
      document.querySelectorAll(".side-button").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active-buy", active && side === "buy");
        item.classList.toggle("active-sell", active && side === "sell");
        item.setAttribute("aria-pressed", String(active));
      });
      nodes.submitOrder.firstElementChild.textContent = side === "buy" ? "Place paper order" : "Place paper sell";
      nodes.feedback.textContent = "";
    });
  });

  document.querySelectorAll(".range-button").forEach((button) => {
    button.addEventListener("click", () => {
      currentRange = button.dataset.range;
      document.querySelectorAll(".range-button").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      drawChart();
    });
  });

  nodes.botList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bot]");
    if (!button) return;
    const bot = state.bots.find((item) => item.id === button.dataset.bot);
    if (!bot) return;
    bot.running = !bot.running;
    state.activity.unshift({
      action: bot.running ? "Bot started" : "Bot paused",
      side: bot.running ? "buy" : "sell",
      symbol: bot.name,
      amount: 0,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    });
    saveState();
    render();
    showToast(`${bot.name} ${bot.running ? "started" : "paused"} in simulation mode.`);
  });

  document.querySelector("#add-strategy").addEventListener("click", () => {
    document.querySelector("#strategy-form").hidden = false;
    document.querySelector("#strategy-select").focus();
  });
  document.querySelector("#cancel-strategy").addEventListener("click", () => {
    document.querySelector("#strategy-form").hidden = true;
  });
  document.querySelector("#confirm-strategy").addEventListener("click", () => {
    const name = document.querySelector("#strategy-select").value;
    const symbol = name === "Range watch" ? "BTC" : name === "Momentum scout" ? "ETH" : "SOL";
    state.bots.push({ id: `bot-${Date.now()}`, name, mode: `${symbol} · sample`, pnl: 0, running: false });
    document.querySelector("#strategy-form").hidden = true;
    saveState();
    render();
    showToast(`${name} added as a paused sample bot.`);
  });
  document.querySelector("#reset-demo").addEventListener("click", () => {
    if (!window.confirm("Reset the demo portfolio, bot states, and activity on this device?")) return;
    state = freshState();
    selectedSymbol = "BTC";
    side = "buy";
    nodes.amount.value = "250";
    nodes.feedback.textContent = "";
    document.querySelectorAll(".side-button").forEach((button) => {
      const active = button.dataset.side === "buy";
      button.classList.toggle("active-buy", active);
      button.classList.toggle("active-sell", !active);
      button.setAttribute("aria-pressed", String(active));
    });
    nodes.submitOrder.firstElementChild.textContent = "Place paper order";
    document.querySelector("#strategy-form").hidden = true;
    saveState();
    render();
    showToast("Demo portfolio reset. No account or exchange was contacted.");
  });

  updateClock();
  render();
  setInterval(updateClock, 1000);
  setInterval(() => {
    const runningBots = state.bots.filter((bot) => bot.running);
    if (!runningBots.length) return;
    runningBots.forEach((bot) => {
      bot.pnl += (Math.random() - 0.46) * 0.22;
    });
    saveState();
    renderBots();
  }, 4500);
})();
