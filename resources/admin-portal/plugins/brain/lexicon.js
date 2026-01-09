export const createLexiconModule = ({ api, refs, state, onSelectHash }) => {
   const renderLexiconList = (items, options = {}) => {
      const append = Boolean(options.append);
      if (!refs.wordListEl) return;
      if (!append) {
         refs.wordListEl.innerHTML = "";
      }
      if (!items.length) {
         if (!append) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "No words found.";
            refs.wordListEl.appendChild(empty);
         }
         return;
      }
      for (const item of items) {
         const button = document.createElement("button");
         button.type = "button";
         button.className = "list-item";
         button.innerHTML = `
            <div class="list-title">
               <span>${item.word}</span>
               <span class="badge">${item.ngramCount}</span>
            </div>
         `;
         button.addEventListener("click", () => {
            state.word.word = item.word;
            state.word.limit = 12;
            void loadWordDetail();
         });
         refs.wordListEl.appendChild(button);
      }
   };

   const loadLexicon = async (options = {}) => {
      if (state.lexicon.loading) return;
      const reset = Boolean(options.reset);
      if (reset) {
         state.lexicon.items = [];
         state.lexicon.offset = 0;
         state.lexicon.total = 0;
         if (refs.wordListEl) refs.wordListEl.scrollTop = 0;
      }
      state.lexicon.loading = true;
      if (refs.wordFooterEl) refs.wordFooterEl.textContent = "Loading...";
      try {
         const params = new URLSearchParams({
            query: state.lexicon.query,
            offset: String(state.lexicon.offset),
            limit: String(state.lexicon.limit)
         });
         const result = await api.get(`/api/brain/lexicon?${params.toString()}`);
         const newItems = result.items ?? [];
         if (reset) {
            state.lexicon.items = newItems;
            renderLexiconList(newItems, { append: false });
         } else {
            state.lexicon.items = state.lexicon.items.concat(newItems);
            renderLexiconList(newItems, { append: true });
         }
         state.lexicon.total = result.total ?? state.lexicon.items.length;
         state.lexicon.offset = state.lexicon.items.length;
         if (refs.wordFooterEl) {
            if (state.lexicon.items.length === 0) {
               refs.wordFooterEl.textContent = "No words found yet.";
            } else if (state.lexicon.items.length >= state.lexicon.total) {
               refs.wordFooterEl.textContent = "End of results.";
            } else {
               refs.wordFooterEl.textContent = "Scroll to load more.";
            }
         }
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      } finally {
         state.lexicon.loading = false;
      }
   };

   const renderWordDetail = (detail) => {
      if (!refs.wordTitleEl || !refs.wordMetaEl || !refs.wordBodyEl) return;
      if (!detail) {
         refs.wordTitleEl.textContent = "Word detail";
         refs.wordMetaEl.textContent = "Select a word to inspect its trigrams.";
         refs.wordBodyEl.innerHTML = "<div class=\"empty\">No word selected.</div>";
         return;
      }
      refs.wordTitleEl.textContent = detail.word;
      refs.wordMetaEl.textContent = `${detail.ngramCount} trigrams`;
      if (!detail.ngrams || detail.ngrams.length === 0) {
         refs.wordBodyEl.innerHTML = "<div class=\"empty\">No trigrams found.</div>";
         return;
      }
      const wrapper = document.createElement("div");
      wrapper.className = "word-ngram-scroll";
      const list = document.createElement("div");
      list.className = "brain-ngram-list";
      for (const ngram of detail.ngrams) {
         const card = document.createElement("details");
         card.className = "brain-ngram";
         const tokenText = ngram.tokens.join(" ");
         const flags = `${ngram.canStart ? "start" : ""}${ngram.canEnd ? " end" : ""}`.trim();
         card.innerHTML = `
            <summary>
               <span class="summary-title">${tokenText}</span>
               <span class="badge">${flags || "middle"}</span>
            </summary>
            <div class="ngram-meta">hash: ${ngram.hash}</div>
            <div class="ngram-columns">
               <div>
                  <div class="muted">Next tokens</div>
                  <div class="token-list">${ngram.nextTokens.map(item => `<span>${item.token} (${item.count})</span>`).join("") || "<span>none</span>"}</div>
               </div>
               <div>
                  <div class="muted">Previous tokens</div>
                  <div class="token-list">${ngram.previousTokens.map(item => `<span>${item.token} (${item.count})</span>`).join("") || "<span>none</span>"}</div>
               </div>
            </div>
            <div class="row drilldown-row">
               <button class="button ghost small" type="button" data-hash="${ngram.hash}">Open in ngram detail</button>
            </div>
         `;
         const drillButton = card.querySelector("[data-hash]");
         drillButton?.addEventListener("click", () => {
            if (refs.hashInput) refs.hashInput.value = ngram.hash;
            if (typeof onSelectHash === "function") {
               void onSelectHash(ngram.hash);
            }
         });
         list.appendChild(card);
      }
      refs.wordBodyEl.innerHTML = "";
      wrapper.appendChild(list);
      if (detail.ngramCount > detail.ngrams.length) {
         const notice = document.createElement("div");
         notice.className = "list-footer";
         notice.textContent = "Scroll to load more trigrams.";
         wrapper.appendChild(notice);
      }
      wrapper.addEventListener("scroll", () => {
         const nearBottom = wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 60;
         if (nearBottom && detail.ngramCount > detail.ngrams.length && !state.word.loading) {
            state.word.limit += 12;
            void loadWordDetail();
         }
      });
      refs.wordBodyEl.appendChild(wrapper);
   };

   const loadWordDetail = async () => {
      if (!state.word.word) {
         renderWordDetail(null);
         return;
      }
      if (state.word.loading) return;
      state.word.loading = true;
      try {
         const params = new URLSearchParams({
            word: state.word.word,
            limit: String(state.word.limit)
         });
         const detail = await api.get(`/api/brain/word?${params.toString()}`);
         state.word.total = detail?.ngramCount ?? 0;
         renderWordDetail(detail);
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      } finally {
         state.word.loading = false;
      }
   };

   const bindLexiconEvents = () => {
      refs.searchInput?.addEventListener("input", () => {
         state.lexicon.query = String(refs.searchInput?.value || "").trim().toLowerCase();
         void loadLexicon({ reset: true });
      });

      refs.pageSizeSelect?.addEventListener("change", () => {
         const value = Number(refs.pageSizeSelect.value || 50);
         state.lexicon.limit = Number.isFinite(value) ? value : 50;
         void loadLexicon({ reset: true });
      });

      let lexiconScrollFrame = null;
      refs.wordListEl?.addEventListener("scroll", () => {
         if (lexiconScrollFrame) return;
         lexiconScrollFrame = requestAnimationFrame(() => {
            lexiconScrollFrame = null;
            if (!refs.wordListEl) return;
            const nearBottom = refs.wordListEl.scrollTop + refs.wordListEl.clientHeight >= refs.wordListEl.scrollHeight - 80;
            if (nearBottom && !state.lexicon.loading && state.lexicon.items.length < state.lexicon.total) {
               void loadLexicon();
            }
         });
      });
   };

   return {
      loadLexicon,
      loadWordDetail,
      bindLexiconEvents
   };
};
