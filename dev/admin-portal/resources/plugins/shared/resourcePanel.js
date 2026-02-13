const formatBytes = (value) => {
   if (!Number.isFinite(value)) return "0 B";
   if (value < 1024) return `${value} B`;
   const kb = value / 1024;
   if (kb < 1024) return `${kb.toFixed(1)} KB`;
   return `${(kb / 1024).toFixed(1)} MB`;
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

const buildDownloadUrl = (pluginId, type, filePath) =>
   `/api/resources/download?plugin=${encodeURIComponent(pluginId)}&type=${encodeURIComponent(type)}&path=${encodeURIComponent(filePath)}`;

const arrayBufferToBase64 = (buffer) => {
   let binary = "";
   const bytes = new Uint8Array(buffer);
   const chunkSize = 0x8000;
   for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
   }
   return btoa(binary);
};

export async function renderResourcePanel(container, context, options) {
   const { api } = context;
   const pluginId = options.pluginId;
   const type = options.type ?? "resources";
   const title = options.title ?? "Resources";
   const subtitle = options.subtitle ?? "";

   container.innerHTML = `
      <div class="panel-title">${title}</div>
      ${subtitle ? `<div class="panel-subtitle">${subtitle}</div>` : ""}
      <div class="status" id="resource-status"></div>
      <div class="grid two-col">
         <section class="card">
            <div class="card-header">
               <div>
                  <h3>Files</h3>
                  <p class="muted">Resources in ${type} for ${pluginId}.</p>
               </div>
               <button class="button ghost" type="button" data-action="refresh">Refresh</button>
            </div>
            <input id="resource-search" type="search" placeholder="Filter by path">
            <div class="list" id="resource-list"></div>
         </section>
         <section class="card">
            <div class="card-header">
               <div>
                  <h3 id="resource-detail-title">Select a file</h3>
                  <p class="muted" id="resource-detail-meta">Choose a file to view or edit.</p>
               </div>
            </div>
            <div class="detail-body" id="resource-detail-body">
               <div class="empty">No file selected.</div>
            </div>
         </section>
      </div>
   `;

   const statusEl = container.querySelector("#resource-status");
   const listEl = container.querySelector("#resource-list");
   const searchEl = container.querySelector("#resource-search");
   const detailTitleEl = container.querySelector("#resource-detail-title");
   const detailMetaEl = container.querySelector("#resource-detail-meta");
   const detailBodyEl = container.querySelector("#resource-detail-body");
   const refreshButton = container.querySelector("[data-action='refresh']");

   const state = {
      files: [],
      active: null
   };

   const renderList = () => {
      listEl.innerHTML = "";
      const query = searchEl.value.trim().toLowerCase();
      const filtered = state.files.filter(file => file.path.toLowerCase().includes(query));
      if (!filtered.length) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No files found.";
         listEl.appendChild(empty);
         return;
      }
      for (const file of filtered) {
         const button = document.createElement("button");
         button.type = "button";
         button.className = "list-item";
         button.dataset.path = file.path;
         if (state.active?.path === file.path) button.classList.add("active");
         button.innerHTML = `
            <div class="list-title">
               <span>${file.path}</span>
               <span class="badge">${file.isText ? "text" : "binary"}</span>
            </div>
            <div class="muted">${formatBytes(file.size)} · ${file.ext || "file"}</div>
         `;
         button.addEventListener("click", () => {
            void selectFile(file.path);
         });
         listEl.appendChild(button);
      }
   };

   const renderDetail = () => {
      if (!state.active) {
         detailTitleEl.textContent = "Select a file";
         detailMetaEl.textContent = "Choose a file to view or edit.";
         detailBodyEl.innerHTML = "<div class=\"empty\">No file selected.</div>";
         return;
      }
      const active = state.active;
      detailTitleEl.textContent = active.path;
      detailMetaEl.textContent = `${formatBytes(active.size)} · ${active.mime}`;
      const downloadUrl = buildDownloadUrl(pluginId, type, active.path);
      const isText = Boolean(active.isText);
      const content = typeof active.content === "string" ? active.content : "";
      detailBodyEl.innerHTML = `
         <div class="meta-grid">
            <div class="field">
               <span>Path</span>
               <div class="muted">${active.path}</div>
            </div>
            <div class="field">
               <span>Last updated</span>
               <div class="muted">${active.updatedAt}</div>
            </div>
            <div class="field">
               <span>Type</span>
               <div class="muted">${active.ext || "file"}</div>
            </div>
            <div class="field">
               <span>Mode</span>
               <div class="muted">${isText ? "editable" : "binary"}</div>
            </div>
         </div>
         ${isText ? `
            <label class="field">
               <span>Contents</span>
               <textarea id="resource-editor" spellcheck="false"></textarea>
            </label>
         ` : `
            <div class="notice">Binary file detected. Use download or replace to update this file.</div>
         `}
         <div class="actions">
            <a class="button ghost" href="${downloadUrl}" target="_blank" rel="noreferrer">Download</a>
            <label class="button ghost" for="resource-upload-input">Replace...</label>
            ${isText ? `<button class="button" type="button" data-action="save">Save</button>` : ""}
         </div>
         <input id="resource-upload-input" type="file" style="display:none;">
      `;

      const uploadInput = detailBodyEl.querySelector("#resource-upload-input");
      if (uploadInput) {
         uploadInput.addEventListener("change", async () => {
            const file = uploadInput.files?.[0];
            if (!file) return;
            try {
               setStatus(statusEl, `Uploading ${file.name}...`);
               const buffer = await file.arrayBuffer();
               const encoded = arrayBufferToBase64(buffer);
               await api.post("/api/resources/file", {
                  plugin: pluginId,
                  type,
                  path: active.path,
                  content: encoded,
                  encoding: "base64"
               });
               setStatus(statusEl, "File updated.", "success");
               await selectFile(active.path);
            } catch (error) {
               const message = error instanceof Error ? error.message : String(error);
               setStatus(statusEl, message, "error");
            } finally {
               uploadInput.value = "";
            }
         });
      }

      const saveButton = detailBodyEl.querySelector("[data-action='save']");
      if (saveButton) {
         saveButton.addEventListener("click", async () => {
            const editor = detailBodyEl.querySelector("#resource-editor");
            if (!(editor instanceof HTMLTextAreaElement)) return;
            try {
               setStatus(statusEl, "Saving...", "info");
               await api.post("/api/resources/file", {
                  plugin: pluginId,
                  type,
                  path: active.path,
                  content: editor.value,
                  encoding: "utf8"
               });
               setStatus(statusEl, "Saved.", "success");
               await selectFile(active.path);
            } catch (error) {
               const message = error instanceof Error ? error.message : String(error);
               setStatus(statusEl, message, "error");
            }
         });
      }

      if (isText) {
         const editor = detailBodyEl.querySelector("#resource-editor");
         if (editor instanceof HTMLTextAreaElement) {
            editor.value = content;
         }
      }
   };

   const loadFiles = async () => {
      try {
         setStatus(statusEl, "Loading files...");
         const result = await api.get(`/api/resources?plugin=${encodeURIComponent(pluginId)}&type=${encodeURIComponent(type)}`);
         state.files = result.files ?? [];
         renderList();
         setStatus(statusEl, "");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   const selectFile = async (path) => {
      try {
         setStatus(statusEl, "Loading file...");
         const result = await api.get(`/api/resources/file?plugin=${encodeURIComponent(pluginId)}&type=${encodeURIComponent(type)}&path=${encodeURIComponent(path)}`);
         state.active = result;
         renderList();
         renderDetail();
         setStatus(statusEl, "");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   searchEl.addEventListener("input", renderList);
   refreshButton.addEventListener("click", () => {
      void loadFiles();
   });

   await loadFiles();
}
