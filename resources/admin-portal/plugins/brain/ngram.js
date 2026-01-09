export const createNgramModule = ({ api, refs, state }) => {
   const ngramState = state.ngram;
   let ngramRowHeight = 34;
   let ngramRowMeasured = false;
   const NGRAM_ROW_BUFFER = 8;
   let tokenPopover = null;
   let tokenPopoverTarget = null;
   let tokenPopoverCleanup = null;

   const closeTokenPopover = () => {
      if (tokenPopoverCleanup) {
         tokenPopoverCleanup();
         tokenPopoverCleanup = null;
      }
      if (tokenPopover) {
         tokenPopover.remove();
         tokenPopover = null;
      }
      tokenPopoverTarget = null;
   };

   const positionPopover = (popover, targetRect) => {
      const padding = 12;
      const popoverRect = popover.getBoundingClientRect();
      let left = targetRect.left;
      let top = targetRect.bottom + 8;
      if (left + popoverRect.width > window.innerWidth - padding) {
         left = window.innerWidth - popoverRect.width - padding;
      }
      if (top + popoverRect.height > window.innerHeight - padding) {
         top = targetRect.top - popoverRect.height - 8;
      }
      left = Math.max(padding, left);
      top = Math.max(padding, top);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
   };

   const openTokenPopover = (target) => {
      if (!(target instanceof HTMLElement)) return;
      const encoded = target.dataset.fullToken;
      if (!encoded) return;
      if (tokenPopoverTarget === target) {
         closeTokenPopover();
         return;
      }
      const token = decodeURIComponent(encoded);
      const count = target.dataset.tokenCount;
      closeTokenPopover();
      tokenPopoverTarget = target;
      const popover = document.createElement("div");
      popover.className = "token-popover";
      popover.innerHTML = `
         ${count ? `<div class="token-popover-meta">Count: ${count}</div>` : ""}
         <div class="token-popover-text">${token}</div>
      `;
      document.body.appendChild(popover);
      tokenPopover = popover;
      positionPopover(popover, target.getBoundingClientRect());
      const handleClick = (event) => {
         if (!(event.target instanceof Node)) return;
         if (popover.contains(event.target) || target.contains(event.target)) return;
         closeTokenPopover();
      };
      const handleKey = (event) => {
         if (event.key === "Escape") closeTokenPopover();
      };
      const handleScroll = (event) => {
         const targetEl = event?.target;
         if (targetEl instanceof Node) {
            if (popover.contains(targetEl) || target.contains(targetEl)) return;
         }
         closeTokenPopover();
      };
      window.addEventListener("click", handleClick);
      window.addEventListener("keydown", handleKey);
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleScroll);
      tokenPopoverCleanup = () => {
         window.removeEventListener("click", handleClick);
         window.removeEventListener("keydown", handleKey);
         window.removeEventListener("scroll", handleScroll, true);
         window.removeEventListener("resize", handleScroll);
      };
   };

   const updateNgramStatus = () => {
      if (!refs.ngramStatusEl) return;
      const index = ngramState.index;
      if (index.state === "building") {
         const totalText = index.total ? ` / ${index.total.toLocaleString()}` : "";
         refs.ngramStatusEl.textContent = `Indexing ${index.scanned.toLocaleString()}${totalText}...`;
         return;
      }
      if (index.stale) {
         refs.ngramStatusEl.textContent = "Index is stale. Refresh to include new brain data.";
         return;
      }
      if (index.builtAt) {
         const builtAt = new Date(index.builtAt).toLocaleTimeString();
         refs.ngramStatusEl.textContent = `Index ready (built ${builtAt}).`;
         return;
      }
      refs.ngramStatusEl.textContent = "Index ready.";
   };

   const updateNgramSortIndicators = () => {
      if (!refs.ngramHeaderEl) return;
      const buttons = refs.ngramHeaderEl.querySelectorAll("[data-sort]");
      buttons.forEach((button) => {
         if (!(button instanceof HTMLElement)) return;
         const key = button.dataset.sort || "";
         if (key === ngramState.sortKey) {
            button.dataset.active = "true";
            button.dataset.dir = ngramState.sortDir;
         } else {
            button.dataset.active = "false";
            button.dataset.dir = "";
         }
      });
   };

   const renderNgramRows = () => {
      if (!refs.ngramBodyEl || !refs.ngramRowsEl || !refs.ngramTrackEl) return;
      const totalRows = ngramState.items.length;
      const viewportHeight = refs.ngramBodyEl.clientHeight;
      const scrollTop = refs.ngramBodyEl.scrollTop;
      const startIndex = Math.max(0, Math.floor(scrollTop / ngramRowHeight) - NGRAM_ROW_BUFFER);
      const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / ngramRowHeight) + NGRAM_ROW_BUFFER);
      refs.ngramTrackEl.style.height = `${totalRows * ngramRowHeight}px`;
      refs.ngramRowsEl.style.transform = `translateY(${startIndex * ngramRowHeight}px)`;
      refs.ngramRowsEl.innerHTML = "";
      for (let index = startIndex; index < endIndex; index += 1) {
         const item = ngramState.items[index];
         if (!item) continue;
         const row = document.createElement("button");
         row.type = "button";
         row.className = "data-table-row";
         row.innerHTML = `
            <span class="mono">${item.hash}</span>
            <span>${item.tokens || "-"}</span>
            <span class="table-flag">${item.canStart ? "yes" : "no"}</span>
            <span class="table-flag">${item.canEnd ? "yes" : "no"}</span>
            <span>${item.nextCount}</span>
            <span>${item.prevCount}</span>
            <span>${item.tokenCount}</span>
            <span>${item.minTokenLength}</span>
            <span>${item.maxTokenLength}</span>
         `;
         row.addEventListener("click", () => {
            if (refs.hashInput) refs.hashInput.value = item.hash;
            void loadHashDetail(item.hash);
         });
         refs.ngramRowsEl.appendChild(row);
         if (!ngramRowMeasured) {
            const measured = row.getBoundingClientRect().height;
            if (measured && Math.abs(measured - ngramRowHeight) > 1) {
               ngramRowHeight = measured;
               ngramRowMeasured = true;
               renderNgramRows();
               return;
            }
            ngramRowMeasured = true;
         }
      }
   };

   const buildNgramQuery = (offset, limit) => {
      const params = new URLSearchParams({
         offset: String(offset),
         limit: String(limit)
      });
      if (ngramState.sortKey) params.set("sortKey", ngramState.sortKey);
      if (ngramState.sortDir) params.set("sortDir", ngramState.sortDir);
      if (ngramState.filters.contains) params.set("contains", ngramState.filters.contains);
      if (ngramState.filters.notContains) params.set("notContains", ngramState.filters.notContains);
      if (ngramState.filters.canStart) params.set("canStart", ngramState.filters.canStart);
      if (ngramState.filters.canEnd) params.set("canEnd", ngramState.filters.canEnd);
      if (ngramState.filters.nextMin) params.set("nextMin", ngramState.filters.nextMin);
      if (ngramState.filters.nextMax) params.set("nextMax", ngramState.filters.nextMax);
      if (ngramState.filters.prevMin) params.set("prevMin", ngramState.filters.prevMin);
      if (ngramState.filters.prevMax) params.set("prevMax", ngramState.filters.prevMax);
      if (ngramState.filters.tokenMin) params.set("tokenLenMin", ngramState.filters.tokenMin);
      if (ngramState.filters.tokenMax) params.set("tokenLenMax", ngramState.filters.tokenMax);
      return params;
   };

   const scheduleNgramPoll = () => {
      if (ngramState.pollTimer) return;
      if (ngramState.index.state !== "building") return;
      ngramState.pollTimer = setTimeout(() => {
         ngramState.pollTimer = null;
         void loadNgramTable({ direction: "forward" });
      }, 1500);
   };

   const loadNgramTable = async (options = {}) => {
      if (ngramState.loading) return;
      const reset = Boolean(options.reset);
      const direction = options.direction ?? "forward";
      if (reset) {
         ngramState.items = [];
         ngramState.windowOffset = 0;
         ngramState.total = 0;
         ngramRowMeasured = false;
         if (refs.ngramBodyEl) refs.ngramBodyEl.scrollTop = 0;
      }
      ngramState.loading = true;
      if (refs.ngramFooterEl) refs.ngramFooterEl.textContent = "Loading...";
      try {
         const offset = reset
            ? 0
            : direction === "backward"
               ? Math.max(0, ngramState.windowOffset - ngramState.chunkSize)
               : ngramState.windowOffset + ngramState.items.length;
         if (!reset && direction === "backward" && offset === ngramState.windowOffset) {
            ngramState.loading = false;
            return;
         }
         const params = buildNgramQuery(offset, ngramState.chunkSize);
         const result = await api.get(`/api/brain/ngrams?${params.toString()}`);
         const newItems = result.items ?? [];
         if (reset) {
            ngramState.items = newItems;
            ngramState.windowOffset = offset;
         } else if (direction === "backward") {
            ngramState.items = newItems.concat(ngramState.items);
            ngramState.windowOffset = offset;
         } else {
            ngramState.items = ngramState.items.concat(newItems);
         }
         if (ngramState.items.length > ngramState.windowSize) {
            if (direction === "backward") {
               ngramState.items = ngramState.items.slice(0, ngramState.windowSize);
            } else {
               const overflow = ngramState.items.length - ngramState.windowSize;
               ngramState.items = ngramState.items.slice(overflow);
               ngramState.windowOffset += overflow;
               if (refs.ngramBodyEl) {
                  refs.ngramBodyEl.scrollTop = Math.max(0, refs.ngramBodyEl.scrollTop - overflow * ngramRowHeight);
               }
            }
         }
         ngramState.total = result.total ?? ngramState.total;
         ngramState.index = result.index ?? ngramState.index;
         updateNgramStatus();
         updateNgramSortIndicators();
         renderNgramRows();
         if (ngramState.index.state !== "building" && ngramState.pollTimer) {
            clearTimeout(ngramState.pollTimer);
            ngramState.pollTimer = null;
         }
         if (refs.ngramFooterEl) {
            const start = ngramState.items.length ? ngramState.windowOffset + 1 : 0;
            const end = ngramState.windowOffset + ngramState.items.length;
            const totalText = ngramState.total ? ` of ${ngramState.total.toLocaleString()}` : "";
            const rangeText = ngramState.items.length ? `Showing ${start.toLocaleString()}-${end.toLocaleString()}${totalText}.` : "";
            if (ngramState.index.state === "building") {
               refs.ngramFooterEl.textContent = ngramState.items.length ? `${rangeText} Indexing more rows...` : "Indexing ngrams...";
            } else if (ngramState.items.length === 0) {
               refs.ngramFooterEl.textContent = "No ngrams found yet.";
            } else if (ngramState.total && end >= ngramState.total) {
               refs.ngramFooterEl.textContent = `${rangeText} End of results.`;
            } else {
               refs.ngramFooterEl.textContent = `${rangeText} Scroll to load more.`;
            }
         }
         scheduleNgramPoll();
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      } finally {
         ngramState.loading = false;
      }
   };

   const renderHashDetail = (detail) => {
      if (!refs.hashBodyEl) return;
      closeTokenPopover();
      if (!detail) {
         refs.hashBodyEl.innerHTML = "<div class=\"empty\">No trigram selected.</div>";
         return;
      }
      const tokenText = detail.tokens.join(" ");
      const encodedTokenText = encodeURIComponent(tokenText);
      const metadataEntries = Object.entries(detail)
         .filter(([key]) => !["hash", "tokens", "nextTokens", "previousTokens"].includes(key))
         .map(([key, value]) => {
            let displayValue = "";
            if (typeof value === "boolean") displayValue = value ? "yes" : "no";
            else if (typeof value === "number" || typeof value === "string") displayValue = String(value);
            else if (Array.isArray(value)) displayValue = value.join(", ");
            else displayValue = "[object]";
            const label = key.replace(/([A-Z])/g, " $1").toLowerCase();
            return `<div class=\"meta-row\"><span class=\"meta-key\">${label}</span><span class=\"meta-value\">${displayValue}</span></div>`;
         });
      const metadataHtml = metadataEntries.length ? metadataEntries.join("") : "<div class=\"muted\">none</div>";
      const renderTokenButtons = (items, direction) => {
         if (!items.length) return "<span class=\"token-empty\">none</span>";
         return items
            .map(item => {
               const encoded = encodeURIComponent(item.token);
               return `<button class=\"token-chip\" type=\"button\" data-${direction}-token=\"${encoded}\" data-full-token=\"${encoded}\" data-token-count=\"${item.count}\">${item.token} (${item.count})</button>`;
            })
            .join("");
      };
      const renderGraphTokens = (items, direction) => {
         if (!items.length) return "<span class=\"token-empty\">none</span>";
         return `
            <div class=\"graph-list\">
               ${items
                  .map(item => {
                     const encoded = encodeURIComponent(item.token);
                     const count = Number(item.count ?? 0);
                     return `
                        <button class=\"graph-token\" type=\"button\" data-${direction}-token=\"${encoded}\">
                           <span class=\"graph-text\">${item.token}</span>
                           <span class=\"graph-count\">${count}</span>
                        </button>
                     `;
                  })
                  .join("")}
            </div>
         `;
      };
      const prevCount = detail.previousTokens?.length ?? 0;
      const nextCount = detail.nextTokens?.length ?? 0;
      refs.hashBodyEl.innerHTML = `
         <div class=\"stat-grid\">
            <div class=\"stat\">
               <div class=\"stat-label\">Tokens</div>
               <button class=\"token-preview\" type=\"button\" data-full-token=\"${encodedTokenText}\">${tokenText}</button>
            </div>
            <div class=\"stat\">
               <div class=\"stat-label\">Metadata</div>
               <div class=\"meta-list\">${metadataHtml}</div>
            </div>
         </div>
         <div class=\"ngram-columns\">
            <div>
               <div class=\"muted\">Previous tokens (${prevCount})</div>
               <div class=\"token-list\">${renderTokenButtons(detail.previousTokens, "prev")}</div>
            </div>
            <div>
               <div class=\"muted\">Next tokens (${nextCount})</div>
               <div class=\"token-list\">${renderTokenButtons(detail.nextTokens, "next")}</div>
            </div>
         </div>
         <div class=\"graph-actions\">
            <button class=\"button ghost small\" type=\"button\" id=\"brain-graph-open\">Preview graph</button>
         </div>
      `;

      const separatorCandidate = String.fromCharCode(0x2502);
      const separator = String(detail.hash || "").includes(separatorCandidate) ? separatorCandidate : "|";
      const tokenButtons = refs.hashBodyEl.querySelectorAll("[data-next-token], [data-prev-token]");
      tokenButtons.forEach((button) => {
         button.addEventListener("click", () => {
            if (!(button instanceof HTMLElement)) return;
            const nextToken = button.dataset.nextToken ? decodeURIComponent(button.dataset.nextToken) : null;
            const prevToken = button.dataset.prevToken ? decodeURIComponent(button.dataset.prevToken) : null;
            if (!ngramState.currentTokens || ngramState.currentTokens.length === 0) return;
            const baseTokens = ngramState.currentTokens;
            const chainLength = baseTokens.length;
            let nextTokens;
            if (nextToken) {
               nextTokens = baseTokens.slice(1).concat([nextToken]);
            } else if (prevToken) {
               nextTokens = [prevToken].concat(baseTokens.slice(0, chainLength - 1));
            } else {
               return;
            }
            const nextHash = nextTokens.join(separator);
            void loadHashDetail(nextHash);
         });
      });

      const popoverTargets = refs.hashBodyEl.querySelectorAll("[data-full-token]");
      popoverTargets.forEach((target) => {
         target.addEventListener("click", (event) => {
            event.stopPropagation();
            openTokenPopover(target);
         });
         target.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
               event.preventDefault();
               openTokenPopover(target);
            }
         });
      });

      const graphButton = refs.hashBodyEl.querySelector("#brain-graph-open");
      graphButton?.addEventListener("click", () => {
         openGraphModal(detail, separator, renderGraphTokens);
      });
   };

   const fetchNgramDetail = async (hash) => {
      const params = new URLSearchParams({
         hash,
         limit: "9999"
      });
      return api.get(`/api/brain/ngram?${params.toString()}`);
   };

   const loadHashDetail = async (hashValue, options = {}) => {
      const hash = String(hashValue || refs.hashInput?.value || "").trim();
      if (!hash) {
         renderHashDetail(null);
         return null;
      }
      if (refs.hashInput && refs.hashInput.value !== hash) {
         refs.hashInput.value = hash;
      }
      if (refs.hashBodyEl) {
         refs.hashBodyEl.innerHTML = "<div class=\"muted\">Loading ngram detail...</div>";
      }
      try {
         const detail = await fetchNgramDetail(hash);
         ngramState.currentHash = hash;
         ngramState.currentTokens = detail.tokens ?? [];
         renderHashDetail(detail);
         if (options.scroll !== false) {
            const detailCard = document.querySelector("#brain-ngram-detail-card");
            detailCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
         }
         return detail;
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      }
      return null;
   };

   const openGraphModal = (detail, separator, renderGraphTokens) => {
      const existing = document.querySelector(".graph-modal-backdrop");
      if (existing) existing.remove();
      const modal = document.createElement("div");
      modal.className = "graph-modal-backdrop";
      modal.innerHTML = `
         <div class=\"graph-modal\">
            <div class=\"graph-modal-header\">
               <div>
                  <div class=\"panel-title\">Ngram graph preview</div>
                  <div class=\"muted\" data-graph-meta></div>
               </div>
               <button class=\"button ghost\" type=\"button\" data-close>Close</button>
            </div>
            <div class=\"graph-modal-body\" data-graph-body></div>
         </div>
      `;
      document.body.appendChild(modal);

      let cleanupGraphLines = null;

      const closeModal = () => {
         if (cleanupGraphLines) {
            cleanupGraphLines();
            cleanupGraphLines = null;
         }
         modal.remove();
      };
      modal.addEventListener("click", (event) => {
         if (event.target === modal) closeModal();
      });
      modal.querySelector("[data-close]")?.addEventListener("click", closeModal);

      const renderGraphModal = (graphDetail) => {
         const prevCount = graphDetail.previousTokens?.length ?? 0;
         const nextCount = graphDetail.nextTokens?.length ?? 0;
         const body = modal.querySelector("[data-graph-body]");
         const meta = modal.querySelector("[data-graph-meta]");
         if (meta) {
            meta.textContent = `Total: ${prevCount} prev, ${nextCount} next.`;
         }
         if (body) {
            body.innerHTML = `
               <div class=\"graph-canvas\">
                  <svg class=\"graph-lines\" aria-hidden=\"true\"></svg>
                  <div class=\"graph-column graph-scroll ${prevCount ? "" : "is-empty"}\" data-side=\"prev\">
                     ${renderGraphTokens(graphDetail.previousTokens, "prev")}
                  </div>
                  <div class=\"graph-center\">
                     <div class=\"graph-node\">${graphDetail.tokens.join(" ")}</div>
                  </div>
                  <div class=\"graph-column graph-scroll ${nextCount ? "" : "is-empty"}\" data-side=\"next\">
                     ${renderGraphTokens(graphDetail.nextTokens, "next")}
                  </div>
               </div>
            `;
         }

         const canvas = modal.querySelector(".graph-canvas");
         const svg = canvas?.querySelector(".graph-lines");
         const centerNode = canvas?.querySelector(".graph-node");
         const prevColumn = canvas?.querySelector('.graph-column[data-side="prev"]');
         const nextColumn = canvas?.querySelector('.graph-column[data-side="next"]');

         if (cleanupGraphLines) {
            cleanupGraphLines();
            cleanupGraphLines = null;
         }

         if (canvas && svg && centerNode) {
            let frame = null;
            const renderLines = () => {
               frame = null;
               const canvasRect = canvas.getBoundingClientRect();
               if (canvasRect.width <= 0 || canvasRect.height <= 0) return;
               svg.setAttribute("viewBox", `0 0 ${canvasRect.width} ${canvasRect.height}`);
               const centerRect = centerNode.getBoundingClientRect();
               const centerLeftX = centerRect.left - canvasRect.left;
               const centerRightX = centerRect.right - canvasRect.left;
               const centerMidY = centerRect.top + centerRect.height / 2 - canvasRect.top;
               const lines = [];
               const addLines = (column, side) => {
                  if (!column) return;
                  const columnRect = column.getBoundingClientRect();
                  const tokens = column.querySelectorAll(".graph-token");
                  tokens.forEach((token) => {
                     if (!(token instanceof HTMLElement)) return;
                     const rect = token.getBoundingClientRect();
                     const visible = rect.bottom >= columnRect.top && rect.top <= columnRect.bottom;
                     if (!visible) return;
                     const tokenMidY = rect.top + rect.height / 2 - canvasRect.top;
                     if (tokenMidY < 0 || tokenMidY > canvasRect.height) return;
                     const x1 = side === "prev" ? centerLeftX : centerRightX;
                     const x2 = side === "prev" ? rect.right - canvasRect.left : rect.left - canvasRect.left;
                     const y1 = centerMidY;
                     const y2 = tokenMidY;
                     const dx = x2 - x1;
                     const cx1 = x1 + dx * 0.35;
                     const cx2 = x1 + dx * 0.65;
                     const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
                     lines.push(`<path d="${d}" />`);
                  });
               };
               addLines(prevColumn, "prev");
               addLines(nextColumn, "next");
               svg.innerHTML = lines.join("");
            };
            const scheduleLines = () => {
               if (frame) return;
               frame = requestAnimationFrame(renderLines);
            };
            prevColumn?.addEventListener("scroll", scheduleLines);
            nextColumn?.addEventListener("scroll", scheduleLines);
            window.addEventListener("resize", scheduleLines);
            scheduleLines();
            cleanupGraphLines = () => {
               prevColumn?.removeEventListener("scroll", scheduleLines);
               nextColumn?.removeEventListener("scroll", scheduleLines);
               window.removeEventListener("resize", scheduleLines);
               if (frame) cancelAnimationFrame(frame);
               frame = null;
            };
         }

         const graphButtons = modal.querySelectorAll("[data-next-token], [data-prev-token]");
         graphButtons.forEach((button) => {
            button.addEventListener("click", async () => {
               if (!(button instanceof HTMLElement)) return;
               const nextToken = button.dataset.nextToken ? decodeURIComponent(button.dataset.nextToken) : null;
               const prevToken = button.dataset.prevToken ? decodeURIComponent(button.dataset.prevToken) : null;
               const baseTokens = graphDetail.tokens ?? ngramState.currentTokens;
               if (!baseTokens || baseTokens.length === 0) return;
               const chainLength = baseTokens.length;
               let nextTokens;
               if (nextToken) {
                  nextTokens = baseTokens.slice(1).concat([nextToken]);
               } else if (prevToken) {
                  nextTokens = [prevToken].concat(baseTokens.slice(0, chainLength - 1));
               } else {
                  return;
               }
               const nextHash = nextTokens.join(separator);
               const nextDetail = await fetchNgramDetail(nextHash);
               if (!nextDetail) return;
               ngramState.currentHash = nextHash;
               ngramState.currentTokens = nextDetail.tokens ?? [];
               renderHashDetail(nextDetail);
               renderGraphModal(nextDetail);
            });
         });
         if (body) {
            body.scrollTop = 0;
         }
      };

      renderGraphModal(detail);
      return;
   };

   const syncNgramFilters = () => {
      ngramState.filters.contains = String(refs.ngramContainsInput?.value || "").trim().toLowerCase();
      ngramState.filters.notContains = String(refs.ngramNotContainsInput?.value || "").trim().toLowerCase();
      ngramState.filters.nextMin = String(refs.ngramNextMinInput?.value || "").trim();
      ngramState.filters.nextMax = String(refs.ngramNextMaxInput?.value || "").trim();
      ngramState.filters.prevMin = String(refs.ngramPrevMinInput?.value || "").trim();
      ngramState.filters.prevMax = String(refs.ngramPrevMaxInput?.value || "").trim();
      ngramState.filters.tokenMin = String(refs.ngramTokenMinInput?.value || "").trim();
      ngramState.filters.tokenMax = String(refs.ngramTokenMaxInput?.value || "").trim();
      ngramState.filters.canStart = String(refs.ngramCanStartSelect?.value || "any");
      ngramState.filters.canEnd = String(refs.ngramCanEndSelect?.value || "any");
   };

   const applyNgramFilters = () => {
      syncNgramFilters();
      void loadNgramTable({ reset: true });
   };

   const bindNgramEvents = () => {
      refs.ngramContainsInput?.addEventListener("input", applyNgramFilters);
      refs.ngramNotContainsInput?.addEventListener("input", applyNgramFilters);
      refs.ngramNextMinInput?.addEventListener("input", applyNgramFilters);
      refs.ngramNextMaxInput?.addEventListener("input", applyNgramFilters);
      refs.ngramPrevMinInput?.addEventListener("input", applyNgramFilters);
      refs.ngramPrevMaxInput?.addEventListener("input", applyNgramFilters);
      refs.ngramTokenMinInput?.addEventListener("input", applyNgramFilters);
      refs.ngramTokenMaxInput?.addEventListener("input", applyNgramFilters);
      refs.ngramCanStartSelect?.addEventListener("change", applyNgramFilters);
      refs.ngramCanEndSelect?.addEventListener("change", applyNgramFilters);

      refs.ngramHeaderEl?.addEventListener("click", (event) => {
         const target = event.target;
         if (!(target instanceof HTMLElement)) return;
         const sortKey = target.dataset.sort;
         if (!sortKey) return;
         if (ngramState.sortKey === sortKey) {
            ngramState.sortDir = ngramState.sortDir === "asc" ? "desc" : "asc";
         } else {
            ngramState.sortKey = sortKey;
            const numericKeys = ["nextCount", "prevCount", "tokenCount", "minTokenLength", "maxTokenLength"];
            ngramState.sortDir = numericKeys.includes(sortKey) ? "desc" : "asc";
         }
         void loadNgramTable({ reset: true });
      });

      refs.ngramRefreshButton?.addEventListener("click", async () => {
         try {
            await api.post("/api/brain/ngrams/refresh", {});
            ngramState.items = [];
            ngramState.windowOffset = 0;
            ngramState.total = 0;
            ngramState.index = { state: "building", scanned: 0, total: 0, builtAt: null, stale: false };
            updateNgramStatus();
            void loadNgramTable({ reset: true });
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
         }
      });

      let ngramScrollFrame = null;
      refs.ngramBodyEl?.addEventListener("scroll", () => {
         if (ngramScrollFrame) return;
         ngramScrollFrame = requestAnimationFrame(() => {
            ngramScrollFrame = null;
            renderNgramRows();
            if (!refs.ngramBodyEl) return;
            const nearBottom = refs.ngramBodyEl.scrollTop + refs.ngramBodyEl.clientHeight >= refs.ngramBodyEl.scrollHeight - (ngramRowHeight * 6);
            const nearTop = refs.ngramBodyEl.scrollTop <= ngramRowHeight * 6;
            if (nearBottom && !ngramState.loading && (ngramState.windowOffset + ngramState.items.length < ngramState.total || ngramState.index.state === "building")) {
               void loadNgramTable({ direction: "forward" });
            } else if (nearTop && !ngramState.loading && ngramState.windowOffset > 0) {
               void loadNgramTable({ direction: "backward" });
            }
         });
      });

      refs.hashLoadButton?.addEventListener("click", () => {
         void loadHashDetail();
      });
   };

   return {
      loadNgramTable,
      loadHashDetail,
      bindNgramEvents
   };
};
