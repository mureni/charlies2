const buildSourceLabel = (source) => {
   if (!source) return "";
   if (source === "builtin") return "builtin";
   if (source === "base") return "base";
   if (source === "overlay") return "overlay";
   if (source === "overlay-only") return "overlay only";
   return source;
};

const normalizeType = (value) => {
   const trimmed = value.trim();
   if (!trimmed) return "";
   if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
   return `[${trimmed}]`;
};

const setStatus = (el, message, tone = "info") => {
   if (!message) {
      el.textContent = "";
      el.dataset.tone = "";
      el.classList.remove("visible");
      return;
   }
   el.textContent = message;
   el.dataset.tone = tone;
   el.classList.add("visible");
};

const buildSummary = (snapshot) => {
   const patterns = snapshot?.merged?.patterns?.length ?? 0;
   const vocabTypes = snapshot?.merged?.vocab ? Object.keys(snapshot.merged.vocab).length : 0;
   const tombstonePatterns = snapshot?.overlay?.tombstones?.patterns?.length ?? 0;
   const tombstoneVocabTypes = snapshot?.overlay?.tombstones?.vocab ? Object.keys(snapshot.overlay.tombstones.vocab).length : 0;
   return { patterns, vocabTypes, tombstonePatterns, tombstoneVocabTypes };
};

export async function render(container, context) {
   const { api } = context;
   container.innerHTML = `
      <div class="panel-title">Madlibs Studio</div>
      <div class="panel-subtitle">Manage built-ins, base categories, and overlays without leaving the console.</div>
      <div class="status" id="madlibs-status"></div>
      <div class="grid two-col">
         <section class="card" id="madlibs-list-card">
            <div class="card-header">
               <div>
                  <h3>Categories</h3>
                  <p class="muted">Built-ins are read only. Overlays add or hide items.</p>
               </div>
               <button class="button ghost" type="button" data-action="refresh">Refresh</button>
            </div>
            <input id="madlibs-search" type="search" placeholder="Filter categories">
            <details class="detail new-category">
               <summary>New category</summary>
               <div class="meta-grid">
                  <label class="field">
                     <span>Id (required)</span>
                     <input id="madlibs-new-id" type="text" placeholder="moodboard">
                  </label>
                  <label class="field">
                     <span>Name</span>
                     <input id="madlibs-new-name" type="text" placeholder="Moodboard">
                  </label>
                  <label class="field">
                     <span>Description</span>
                     <textarea id="madlibs-new-description" placeholder="Short description for help text."></textarea>
                  </label>
                  <label class="field">
                     <span>Usage</span>
                     <input id="madlibs-new-usage" type="text" placeholder="moodboard">
                  </label>
                  <label class="field">
                     <span>Example</span>
                     <input id="madlibs-new-example" type="text" placeholder="moodboard">
                  </label>
                  <label class="field">
                     <span>Matcher (regex, optional)</span>
                     <input id="madlibs-new-matcher" type="text" placeholder="^moodboard(s)?$">
                  </label>
                  <label class="field">
                     <span>Matcher flags</span>
                     <input id="madlibs-new-flags" type="text" placeholder="ui">
                  </label>
               </div>
               <div class="meta-hint">
                  Leave matcher empty to use <code>madlib &lt;category&gt;</code> only. Regex has no slashes.
               </div>
               <div class="actions">
                  <button class="button" type="button" id="madlibs-new-create">Create category</button>
               </div>
            </details>
            <div class="list" id="madlibs-list"></div>
         </section>
         <section class="card" id="madlibs-detail-card">
            <div class="card-header">
               <div>
                  <h3 id="madlibs-detail-title">Select a category</h3>
                  <p class="muted" id="madlibs-detail-meta">Pick a category to inspect and edit.</p>
               </div>
               <span class="chip" id="madlibs-detail-source"></span>
            </div>
            <div class="detail-body" id="madlibs-detail-body">
               <div class="empty">No category selected.</div>
            </div>
         </section>
      </div>
      <section class="card">
         <div class="card-header">
            <div>
               <h3>Access Rules</h3>
               <p class="muted">Allow or deny categories by default, community, or conversation.</p>
            </div>
            <button class="button ghost" type="button" data-action="refresh-access">Reload</button>
         </div>
         <textarea id="madlibs-access" spellcheck="false"></textarea>
         <div class="actions">
            <button class="button" type="button" data-action="save-access">Save access rules</button>
         </div>
      </section>
   `;

   const statusEl = container.querySelector("#madlibs-status");
   const listEl = container.querySelector("#madlibs-list");
   const searchEl = container.querySelector("#madlibs-search");
   const detailTitleEl = container.querySelector("#madlibs-detail-title");
   const detailMetaEl = container.querySelector("#madlibs-detail-meta");
   const detailSourceEl = container.querySelector("#madlibs-detail-source");
   const detailBodyEl = container.querySelector("#madlibs-detail-body");
   const accessTextarea = container.querySelector("#madlibs-access");
   const newIdInput = container.querySelector("#madlibs-new-id");
   const newNameInput = container.querySelector("#madlibs-new-name");
   const newDescriptionInput = container.querySelector("#madlibs-new-description");
   const newUsageInput = container.querySelector("#madlibs-new-usage");
   const newExampleInput = container.querySelector("#madlibs-new-example");
   const newMatcherInput = container.querySelector("#madlibs-new-matcher");
   const newFlagsInput = container.querySelector("#madlibs-new-flags");
   const newCreateButton = container.querySelector("#madlibs-new-create");

   const state = {
      categories: [],
      categoryMap: new Map(),
      activeId: null,
      activeInfo: null,
      snapshot: null
   };

   const renderList = () => {
      const query = searchEl.value.trim().toLowerCase();
      listEl.innerHTML = "";
      const filtered = state.categories.filter(item => item.id.includes(query));
      if (filtered.length === 0) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No matching categories.";
         listEl.appendChild(empty);
         return;
      }
      for (const category of filtered) {
         const button = document.createElement("button");
         button.type = "button";
         button.className = "list-item";
         button.dataset.id = category.id;
         button.innerHTML = `
            <div class="list-title">
               <span>${category.id}</span>
               <span class="badge">${buildSourceLabel(category.source)}</span>
            </div>
            <div class="muted">Patterns: ${category.patterns} · Vocab: ${category.vocabTypes}</div>
         `;
         if (category.id === state.activeId) {
            button.classList.add("active");
         }
         button.addEventListener("click", () => {
            void selectCategory(category.id);
         });
         listEl.appendChild(button);
      }
   };

   const buildMetaPayload = (values) => {
      const meta = {};
      for (const [key, value] of Object.entries(values)) {
         if (typeof value !== "string") continue;
         const trimmed = value.trim();
         if (trimmed) meta[key] = trimmed;
      }
      return meta;
   };

   const renderDetails = () => {
      const info = state.activeInfo;
      const snapshot = state.snapshot;
      if (!info || !snapshot) {
         detailTitleEl.textContent = "Select a category";
         detailMetaEl.textContent = "Pick a category to inspect and edit.";
         detailSourceEl.textContent = "";
         detailBodyEl.innerHTML = "<div class=\"empty\">No category selected.</div>";
         return;
      }
      const summary = buildSummary(snapshot);
      detailTitleEl.textContent = info.id;
      detailMetaEl.textContent = `Patterns: ${summary.patterns} · Vocab types: ${summary.vocabTypes}`;
      detailSourceEl.textContent = buildSourceLabel(info.source);
      detailSourceEl.dataset.source = info.source;

      const baseJson = snapshot.base ? JSON.stringify(snapshot.base, null, 2) : "{}";
      const overlayJson = snapshot.overlay ? JSON.stringify(snapshot.overlay, null, 2) : "{}";
      const mergedJson = snapshot.merged ? JSON.stringify(snapshot.merged, null, 2) : "{}";
      const readOnlyLabel = snapshot.readOnly ? "Read only" : "Editable";

      const vocabTypes = Object.keys(snapshot.merged?.vocab ?? {}).sort();
      const patterns = snapshot.merged?.patterns ?? [];
      const readOnlyNotice = snapshot.readOnly
         ? "<div class=\"notice\">Built-in categories are read only.</div>"
         : "";
      const tokenHints = `
         <details class="detail hint">
            <summary>Vocab token helpers</summary>
            <div class="hint-grid">
               <div><code>#</code> random digit 0-9 (no brackets needed)</div>
               <div><code>[A-Z]</code> random uppercase letter</div>
               <div><code>[a-z]</code> random lowercase letter</div>
               <div><code>[####]</code> grouped digits (same as ####)</div>
               <div><code>{n}</code> repeat previous token/group</div>
               <div><code>{m,n}</code> repeat with a random range</div>
               <div><code>\\</code> escape a token</div>
            </div>
            <div class="hint-example">
               Example: <code>JIRA-[A-Z]{2}-[####]</code> -> <code>JIRA-KM-1047</code>
            </div>
         </details>
      `;
      const meta = snapshot.meta ?? { id: info.id, name: info.id };
      const metaSection = `
         <details class="detail meta-section" open>
            <summary>Metadata</summary>
            <div class="meta-grid">
               <label class="field">
                  <span>Id</span>
                  <input id="madlibs-meta-id" type="text" value="${meta.id ?? info.id}" disabled>
               </label>
               <label class="field">
                  <span>Name</span>
                  <input id="madlibs-meta-name" type="text" value="${meta.name ?? ""}">
               </label>
               <label class="field">
                  <span>Description</span>
                  <textarea id="madlibs-meta-description" placeholder="Short description for help text.">${meta.description ?? ""}</textarea>
               </label>
               <label class="field">
                  <span>Usage</span>
                  <input id="madlibs-meta-usage" type="text" value="${meta.usage ?? ""}" placeholder="${info.id}">
               </label>
               <label class="field">
                  <span>Example</span>
                  <input id="madlibs-meta-example" type="text" value="${meta.example ?? ""}" placeholder="${info.id}">
               </label>
               <label class="field">
                  <span>Matcher (regex, optional)</span>
                  <input id="madlibs-meta-matcher" type="text" value="${meta.matcher ?? ""}" placeholder="^${info.id}$">
               </label>
               <label class="field">
                  <span>Matcher flags</span>
                  <input id="madlibs-meta-flags" type="text" value="${meta.matcherFlags ?? ""}" placeholder="ui">
               </label>
            </div>
            <div class="meta-hint">
               Matcher is a JavaScript regex without slashes. Leave it blank to rely on <code>madlib &lt;category&gt;</code>.
            </div>
            <div class="actions">
               <button class="button" type="button" id="madlibs-meta-save">Save metadata</button>
               <button class="button ghost" type="button" id="madlibs-meta-reset">Reset overrides</button>
            </div>
         </details>
      `;

      detailBodyEl.innerHTML = `
         <div class="stat-grid">
            <div class="stat">
               <div class="stat-label">Status</div>
               <div class="stat-value">${readOnlyLabel}</div>
            </div>
            <div class="stat">
               <div class="stat-label">Tombstone patterns</div>
               <div class="stat-value">${summary.tombstonePatterns}</div>
            </div>
            <div class="stat">
               <div class="stat-label">Tombstone vocab</div>
               <div class="stat-value">${summary.tombstoneVocabTypes}</div>
            </div>
         </div>
         ${readOnlyNotice}
         ${tokenHints}
         ${metaSection}
         <details class="tree-section" open>
            <summary>
               <span class="summary-title">Vocabulary</span>
               <span class="badge">${summary.vocabTypes} types</span>
            </summary>
            <div class="tree-body">
               <div class="tree-node tree-node-new">
                  <div class="node-row">
                     <span class="node-title">New vocab entry</span>
                  </div>
                  <div class="node-add">
                     <input id="madlibs-vocab-new-type" type="text" placeholder="Vocab type (noun)" list="madlibs-vocab-type-list">
                     <datalist id="madlibs-vocab-type-list"></datalist>
                     <input id="madlibs-vocab-new-word" type="text" placeholder="Word">
                     <button class="button" type="button" id="madlibs-vocab-add-button">Add word</button>
                     <button class="button ghost" type="button" id="madlibs-vocab-add-type">Add type</button>
                  </div>
               </div>
               <div class="tree-list" id="madlibs-vocab-tree"></div>
            </div>
         </details>
         <details class="tree-section" open>
            <summary>
               <span class="summary-title">Patterns</span>
               <span class="badge">${summary.patterns} patterns</span>
            </summary>
            <div class="tree-body">
               <div class="node-add pattern-add">
                  <textarea id="madlibs-pattern-add" placeholder="The [adj] [noun] likes to [verb]."></textarea>
                  <button class="button" type="button" id="madlibs-pattern-add-button">Add pattern</button>
               </div>
               <div class="tree-list" id="madlibs-pattern-tree"></div>
            </div>
         </details>
         <details class="detail" open>
            <summary>Base</summary>
            <pre>${baseJson}</pre>
         </details>
         <details class="detail">
            <summary>Overlay</summary>
            <pre>${overlayJson}</pre>
         </details>
         <details class="detail">
            <summary>Merged</summary>
            <pre>${mergedJson}</pre>
         </details>
      `;

      const canEdit = !snapshot.readOnly;
      const vocabTree = detailBodyEl.querySelector("#madlibs-vocab-tree");
      const patternTree = detailBodyEl.querySelector("#madlibs-pattern-tree");
      const typeList = detailBodyEl.querySelector("#madlibs-vocab-type-list");
      const newTypeInput = detailBodyEl.querySelector("#madlibs-vocab-new-type");
      const newWordInput = detailBodyEl.querySelector("#madlibs-vocab-new-word");
      const addGlobalButton = detailBodyEl.querySelector("#madlibs-vocab-add-button");
      const addTypeButton = detailBodyEl.querySelector("#madlibs-vocab-add-type");
      const addPatternButton = detailBodyEl.querySelector("#madlibs-pattern-add-button");
      const addPatternInput = detailBodyEl.querySelector("#madlibs-pattern-add");
      const metaNameInput = detailBodyEl.querySelector("#madlibs-meta-name");
      const metaDescriptionInput = detailBodyEl.querySelector("#madlibs-meta-description");
      const metaUsageInput = detailBodyEl.querySelector("#madlibs-meta-usage");
      const metaExampleInput = detailBodyEl.querySelector("#madlibs-meta-example");
      const metaMatcherInput = detailBodyEl.querySelector("#madlibs-meta-matcher");
      const metaFlagsInput = detailBodyEl.querySelector("#madlibs-meta-flags");
      const metaSaveButton = detailBodyEl.querySelector("#madlibs-meta-save");
      const metaResetButton = detailBodyEl.querySelector("#madlibs-meta-reset");
      if (!canEdit) {
         if (newTypeInput) newTypeInput.disabled = true;
         if (newWordInput) newWordInput.disabled = true;
         if (addPatternInput) addPatternInput.disabled = true;
         if (addTypeButton) addTypeButton.disabled = true;
      }

      const createButton = (label, className = "button ghost small") => {
         const button = document.createElement("button");
         button.type = "button";
         button.className = className;
         button.textContent = label;
         if (!canEdit) button.disabled = true;
         return button;
      };

      const postVocab = async (type, word, action) => {
         if (!type || !word) return false;
         try {
            const result = await api.post("/api/madlibs/vocab", {
               category: info.id,
               type,
               word,
               action
            });
            if (!result.success) {
               api.toast("Update failed.", "error");
               return false;
            }
            api.toast("Vocabulary updated.", "success");
            await selectCategory(info.id);
            return true;
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
            return false;
         }
      };

      const saveMeta = async () => {
         const payload = buildMetaPayload({
            name: String(metaNameInput?.value || ""),
            description: String(metaDescriptionInput?.value || ""),
            usage: String(metaUsageInput?.value || ""),
            example: String(metaExampleInput?.value || ""),
            matcher: String(metaMatcherInput?.value || ""),
            matcherFlags: String(metaFlagsInput?.value || "")
         });
         try {
            await api.post("/api/madlibs/meta", { id: info.id, meta: payload });
            api.toast("Metadata saved.", "success");
            await selectCategory(info.id);
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
         }
      };

      const resetMeta = async () => {
         try {
            await api.post("/api/madlibs/meta", { id: info.id, action: "clear" });
            api.toast("Metadata reset.", "success");
            await selectCategory(info.id);
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
         }
      };

      const postVocabType = async (type) => {
         if (!type) return false;
         try {
            const result = await api.post("/api/madlibs/vocab-type", {
               category: info.id,
               type,
               action: "add"
            });
            if (!result.success) {
               api.toast("Update failed.", "error");
               return false;
            }
            api.toast("Vocab type added.", "success");
            await selectCategory(info.id);
            return true;
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
            return false;
         }
      };

      const postPattern = async (pattern, action) => {
         if (!pattern) return false;
         try {
            const result = await api.post("/api/madlibs/pattern", {
               category: info.id,
               pattern,
               action
            });
            if (!result.success) {
               api.toast("Update failed.", "error");
               return false;
            }
            api.toast("Patterns updated.", "success");
            await selectCategory(info.id);
            return true;
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
            return false;
         }
      };

      const openInlineEditor = (host, value, onSave, options = {}) => {
         if (host.querySelector(".inline-editor")) return;
         const editor = document.createElement("div");
         editor.className = "inline-editor";
         const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
         input.value = value;
         if (options.multiline) input.rows = 3;
         const saveButton = createButton("Save", "button small");
         const cancelButton = createButton("Cancel", "button ghost small");
         if (!canEdit) {
            input.disabled = true;
         }
         saveButton.addEventListener("click", async () => {
            const nextValue = input.value.trim();
            if (!nextValue) {
               api.toast("Value is required.", "error");
               return;
            }
            await onSave(nextValue);
         });
         cancelButton.addEventListener("click", () => {
            editor.remove();
         });
         editor.appendChild(input);
         const actions = document.createElement("div");
         actions.className = "node-actions";
         actions.appendChild(saveButton);
         actions.appendChild(cancelButton);
         editor.appendChild(actions);
         host.appendChild(editor);
         input.focus();
      };

      for (const type of vocabTypes) {
         const option = document.createElement("option");
         option.value = type.replace(/^[\\[]|[\\]]$/g, "");
         typeList.appendChild(option);
      }

      if (addGlobalButton) {
         addGlobalButton.disabled = !canEdit;
         addGlobalButton.addEventListener("click", () => {
            const vocabType = normalizeType(String(newTypeInput?.value || ""));
            const word = String(newWordInput?.value || "").trim();
            if (!vocabType || !word) {
               api.toast("Type and word are required.", "error");
               return;
            }
            void postVocab(vocabType, word, "add");
         });
      }

      if (addTypeButton) {
         addTypeButton.disabled = !canEdit;
         addTypeButton.addEventListener("click", () => {
            const vocabType = normalizeType(String(newTypeInput?.value || ""));
            if (!vocabType) {
               api.toast("Type is required.", "error");
               return;
            }
            void postVocabType(vocabType);
         });
      }

      if (addPatternButton) {
         addPatternButton.disabled = !canEdit;
         addPatternButton.addEventListener("click", () => {
            const pattern = String(addPatternInput?.value || "").trim();
            if (!pattern) {
               api.toast("Pattern is required.", "error");
               return;
            }
            void postPattern(pattern, "add");
         });
      }

      if (metaSaveButton) {
         metaSaveButton.addEventListener("click", () => {
            void saveMeta();
         });
      }

      if (metaResetButton) {
         metaResetButton.addEventListener("click", () => {
            void resetMeta();
         });
      }

      for (const type of vocabTypes) {
         const node = document.createElement("div");
         node.className = "tree-node";
         const row = document.createElement("div");
         row.className = "node-row";
         const title = document.createElement("span");
         title.className = "node-title";
         title.textContent = type;
         row.appendChild(title);
         node.appendChild(row);

         const children = document.createElement("div");
         children.className = "node-children";

         const addRow = document.createElement("div");
         addRow.className = "node-add compact";
         const addInput = document.createElement("input");
         addInput.type = "text";
         addInput.placeholder = `Add word to ${type}`;
         if (!canEdit) addInput.disabled = true;
         const addButton = createButton("Add", "button small");
         addButton.addEventListener("click", () => {
            const word = addInput.value.trim();
            if (!word) {
               api.toast("Word is required.", "error");
               return;
            }
            void postVocab(type, word, "add");
         });
         addRow.appendChild(addInput);
         addRow.appendChild(addButton);
         children.appendChild(addRow);

         const words = snapshot.merged?.vocab?.[type] ?? [];
         for (const word of words) {
            const leaf = document.createElement("div");
            leaf.className = "tree-leaf";
            const label = document.createElement("span");
            label.className = "node-title";
            label.textContent = word;
            const actions = document.createElement("div");
            actions.className = "node-actions";

            const editButton = createButton("Edit");
            editButton.addEventListener("click", () => {
               openInlineEditor(leaf, word, async (nextValue) => {
                  if (nextValue === word) return;
                  const removed = await postVocab(type, word, "remove");
                  if (!removed) return;
                  await postVocab(type, nextValue, "add");
               });
            });

            const removeButton = createButton("Remove");
            removeButton.addEventListener("click", () => {
               void postVocab(type, word, "remove");
            });

            actions.appendChild(editButton);
            actions.appendChild(removeButton);
            leaf.appendChild(label);
            leaf.appendChild(actions);
            children.appendChild(leaf);
         }

         node.appendChild(children);
         vocabTree.appendChild(node);
      }

      if (vocabTypes.length === 0) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No vocab types yet.";
         vocabTree.appendChild(empty);
      }

      for (const pattern of patterns) {
         const leaf = document.createElement("div");
         leaf.className = "tree-leaf";
         const label = document.createElement("span");
         label.className = "node-title";
         label.textContent = pattern;
         const actions = document.createElement("div");
         actions.className = "node-actions";

         const editButton = createButton("Edit");
         editButton.addEventListener("click", () => {
            openInlineEditor(leaf, pattern, async (nextValue) => {
               if (nextValue === pattern) return;
               const removed = await postPattern(pattern, "remove");
               if (!removed) return;
               await postPattern(nextValue, "add");
            }, { multiline: true });
         });

         const removeButton = createButton("Remove");
         removeButton.addEventListener("click", () => {
            void postPattern(pattern, "remove");
         });

         actions.appendChild(editButton);
         actions.appendChild(removeButton);
         leaf.appendChild(label);
         leaf.appendChild(actions);
         patternTree.appendChild(leaf);
      }

      if (patterns.length === 0) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No patterns yet.";
         patternTree.appendChild(empty);
      }
   };

   const loadCategories = async () => {
      setStatus(statusEl, "Loading categories...");
      try {
         const result = await api.get("/api/madlibs/categories");
         state.categories = result.categories ?? [];
         state.categoryMap = new Map(state.categories.map(item => [item.id, item]));
         renderList();
         setStatus(statusEl, "", "info");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
         api.toast(message, "error");
      }
   };

   if (newCreateButton) {
      newCreateButton.addEventListener("click", async () => {
         const id = String(newIdInput?.value || "").trim().toLowerCase();
         if (!id) {
            api.toast("Category id is required.", "error");
            return;
         }
         const meta = buildMetaPayload({
            name: String(newNameInput?.value || ""),
            description: String(newDescriptionInput?.value || ""),
            usage: String(newUsageInput?.value || ""),
            example: String(newExampleInput?.value || ""),
            matcher: String(newMatcherInput?.value || ""),
            matcherFlags: String(newFlagsInput?.value || "")
         });
         try {
            const result = await api.post("/api/madlibs/category", { id, meta });
            if (!result.success) {
               api.toast("Unable to create category.", "error");
               return;
            }
            api.toast("Category created.", "success");
            if (newIdInput) newIdInput.value = "";
            if (newNameInput) newNameInput.value = "";
            if (newDescriptionInput) newDescriptionInput.value = "";
            if (newUsageInput) newUsageInput.value = "";
            if (newExampleInput) newExampleInput.value = "";
            if (newMatcherInput) newMatcherInput.value = "";
            if (newFlagsInput) newFlagsInput.value = "";
            await loadCategories();
            await selectCategory(id);
         } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            api.toast(message, "error");
         }
      });
   }

   const selectCategory = async (id) => {
      state.activeId = id;
      state.activeInfo = state.categoryMap.get(id) ?? null;
      renderList();
      setStatus(statusEl, "Loading category...", "info");
      try {
         const snapshot = await api.get(`/api/madlibs/category?id=${encodeURIComponent(id)}`);
         state.snapshot = snapshot;
         renderDetails();
         setStatus(statusEl, "", "info");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   const loadAccess = async () => {
      try {
         const access = await api.get("/api/madlibs/access");
         accessTextarea.value = JSON.stringify(access ?? {}, null, 2);
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      }
   };

   container.querySelector("[data-action=refresh]").addEventListener("click", () => {
      void loadCategories();
   });

   container.querySelector("[data-action=refresh-access]").addEventListener("click", () => {
      void loadAccess();
   });

   container.querySelector("[data-action=save-access]").addEventListener("click", async () => {
      try {
         const parsed = JSON.parse(accessTextarea.value || "{}");
         await api.post("/api/madlibs/access", parsed);
         api.toast("Access rules saved.", "success");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         api.toast(message, "error");
      }
   });

   searchEl.addEventListener("input", () => {
      renderList();
   });

   await loadCategories();
   await loadAccess();
}
