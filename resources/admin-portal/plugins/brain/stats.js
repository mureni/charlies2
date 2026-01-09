import { formatBytes, scopeLabel } from "./utils.js";

export const createStatsModule = ({ api, refs, state }) => {
   const setStatus = (message, tone = "info") => {
      if (!refs.statusEl) return;
      if (!message) {
         refs.statusEl.textContent = "";
         refs.statusEl.dataset.tone = "";
         refs.statusEl.classList.remove("visible");
         return;
      }
      refs.statusEl.textContent = message;
      refs.statusEl.dataset.tone = tone;
      refs.statusEl.classList.add("visible");
   };

   const loadStats = async () => {
      setStatus("Loading brain stats...");
      try {
         const communityId = String(refs.communityInput?.value || "").trim();
         const url = communityId ? `/api/brain/stats?communityId=${encodeURIComponent(communityId)}` : "/api/brain/stats";
         const result = await api.get(url);
         if (refs.brainNameEl) refs.brainNameEl.textContent = `Brain: ${result.brainName ?? "unknown"}`;
         if (refs.lexiconEl) refs.lexiconEl.textContent = String(result.lexiconCount ?? 0);
         if (refs.ngramEl) refs.ngramEl.textContent = String(result.ngramCount ?? 0);
         if (refs.chainEl) refs.chainEl.textContent = String(result.chainLength ?? 3);
         if (refs.dbEl) refs.dbEl.textContent = formatBytes(result.dbBytes ?? 0);
         const overlayContexts = result.overlays?.contexts ?? [];
         if (refs.overlayCountEl) refs.overlayCountEl.textContent = String(result.overlays?.total ?? overlayContexts.length ?? 0);
         if (refs.overlayListEl) {
            refs.overlayListEl.innerHTML = "";
            if (overlayContexts.length === 0) {
               const empty = document.createElement("div");
               empty.className = "empty";
               empty.textContent = "No overlays recorded yet.";
               refs.overlayListEl.appendChild(empty);
            } else {
               for (const context of overlayContexts) {
                  const item = document.createElement("div");
                  item.className = "list-item";
                  item.innerHTML = `
                     <div class="list-title">
                        <span>${scopeLabel(context.scope)}</span>
                        <span class="badge">${context.id ?? "global"}</span>
                     </div>
                  `;
                  refs.overlayListEl.appendChild(item);
               }
            }
         }
         setStatus("", "info");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(message, "error");
         api.toast(message, "error");
      }
   };

   const renderTopTokens = (items) => {
      if (!refs.topListEl) return;
      refs.topListEl.innerHTML = "";
      if (!items.length) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No tokens available.";
         refs.topListEl.appendChild(empty);
         return;
      }
      const max = Math.max(...items.map(item => item.count));
      for (const item of items) {
         const row = document.createElement("div");
         row.className = "bar-row";
         const width = max > 0 ? Math.max(8, Math.round((item.count / max) * 100)) : 0;
         row.innerHTML = `
            <span class="bar-label">${item.token}</span>
            <div class="bar-track">
               <div class="bar-fill" style="width: ${width}%;"></div>
            </div>
            <span class="bar-count">${item.count}</span>
         `;
         refs.topListEl.appendChild(row);
      }
   };

   const loadTopTokens = async () => {
      try {
         const params = new URLSearchParams({
            limit: String(state.top.limit)
         });
         const result = await api.get(`/api/brain/top?${params.toString()}`);
         renderTopTokens(result.items ?? []);
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      }
   };

   const downloadSnapshot = (compress) => {
      const communityId = String(refs.communityInput?.value || "").trim();
      const params = new URLSearchParams();
      if (communityId) params.set("communityId", communityId);
      if (compress) params.set("compress", "gzip");
      const query = params.toString();
      const url = query ? `/api/brain/snapshot?${query}` : "/api/brain/snapshot";
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      link.click();
   };

   const bindStatsEvents = () => {
      refs.refreshButton?.addEventListener("click", () => {
         void loadStats();
      });
      refs.downloadButton?.addEventListener("click", () => {
         downloadSnapshot(false);
      });
      refs.downloadGzipButton?.addEventListener("click", () => {
         downloadSnapshot(true);
      });
      refs.topLimitSelect?.addEventListener("change", () => {
         const value = Number(refs.topLimitSelect.value || state.top.limit);
         state.top.limit = Number.isFinite(value) ? value : state.top.limit;
         void loadTopTokens();
      });
   };

   return {
      loadStats,
      loadTopTokens,
      bindStatsEvents
   };
};
