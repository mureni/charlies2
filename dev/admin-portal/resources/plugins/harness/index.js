const escapeHtml = (value) =>
   String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

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

const formatBytes = (value) => {
   if (!Number.isFinite(value)) return "";
   if (value < 1024) return `${value} B`;
   const kb = value / 1024;
   if (kb < 1024) return `${kb.toFixed(1)} KB`;
   return `${(kb / 1024).toFixed(1)} MB`;
};

const formatOutgoing = (payload) => {
   const parts = [];
   if (payload.contents) parts.push(payload.contents);
   if (payload.embeds && payload.embeds.length) {
      payload.embeds.forEach(embed => {
         const title = embed.title ? `: ${embed.title}` : "";
         parts.push(`[embed${title}]`);
      });
   }
   if (payload.attachments && payload.attachments.length) {
      payload.attachments.forEach(attachment => {
         const size = attachment.size ? ` (${formatBytes(attachment.size)})` : "";
         parts.push(`[attachment] ${attachment.name}${size}`);
      });
   }
   if (payload.error?.message) parts.push(`Error: ${payload.error.message}`);
   return parts.join("\n");
};

export async function render(container, context) {
   const { api } = context;
   container.innerHTML = `
      <div class="panel-title">Test Harness</div>
      <div class="panel-subtitle">Simulate messages and commands through the live core pipeline.</div>
      <div class="status" id="harness-status"></div>
      <div class="grid two-col">
         <section class="card chat-card">
            <div class="card-header">
               <div>
                  <h3>Conversation</h3>
                  <p class="muted">Send a message and see what the core sends back.</p>
               </div>
               <button class="button ghost" type="button" id="harness-clear">Clear</button>
            </div>
            <div class="chat-feed" id="harness-feed"></div>
            <div class="chat-input">
               <textarea id="harness-message" rows="3" placeholder="Type a message..."></textarea>
               <div class="chat-actions">
                  <button class="button" type="button" id="harness-send">Send</button>
               </div>
            </div>
         </section>
         <section class="card">
            <div class="card-header">
               <div>
                  <h3>Harness Controls</h3>
                  <p class="muted" id="harness-mode-note">Sandbox mode isolates data in a temp directory.</p>
               </div>
            </div>
            <div class="meta-grid">
               <label class="field">
                  <span>Mode</span>
                  <select id="harness-mode">
                     <option value="sandbox">Sandbox (default)</option>
                     <option value="live">Live (mutates data)</option>
                     <option value="proxy">Proxy (attach to running bot)</option>
                  </select>
               </label>
               <label class="field">
                  <span>Author ID</span>
                  <input id="harness-author-id" type="text" value="user-1">
               </label>
               <label class="field">
                  <span>Author name</span>
                  <input id="harness-author-name" type="text" value="User">
               </label>
               <label class="field">
                  <span>Channel ID</span>
                  <input id="harness-channel-id" type="text" value="channel-1">
               </label>
               <label class="field">
                  <span>Channel name</span>
                  <input id="harness-channel-name" type="text" value="general">
               </label>
               <label class="field">
                  <span>Guild ID</span>
                  <input id="harness-guild-id" type="text" placeholder="(optional)">
               </label>
               <label class="field">
                  <span>Guild name</span>
                  <input id="harness-guild-name" type="text" placeholder="(optional)">
               </label>
               <label class="field">
                  <span>Scope</span>
                  <select id="harness-scope">
                     <option value="server">Server</option>
                     <option value="dm">Direct message</option>
                  </select>
               </label>
               <label class="field">
                  <span>Flags</span>
                  <div class="meta-list">
                     <label><input type="checkbox" id="harness-mentions-bot"> Mentions bot</label>
                     <label><input type="checkbox" id="harness-is-bot"> Author is bot</label>
                     <label><input type="checkbox" id="harness-is-self"> Author is self</label>
                     <label><input type="checkbox" id="harness-is-admin"> Is admin</label>
                     <label><input type="checkbox" id="harness-is-owner"> Is bot owner</label>
                  </div>
               </label>
            </div>
            <details class="detail" open>
               <summary>Command Runner</summary>
               <div class="meta-grid">
                  <label class="field">
                     <span>Command</span>
                     <input id="harness-command-name" type="text" placeholder="help">
                  </label>
                  <label class="field">
                     <span>Options (JSON)</span>
                     <textarea id="harness-command-options" rows="4" spellcheck="false" placeholder='{"command":"tarot"}'></textarea>
                  </label>
               </div>
               <div class="actions">
                  <button class="button ghost" type="button" id="harness-command-send">Run command</button>
               </div>
            </details>
            <details class="detail">
               <summary>Run details</summary>
               <pre id="harness-debug" class="code-block"></pre>
            </details>
            <div class="actions">
               <button class="button ghost" type="button" id="harness-reset">Reset sandbox</button>
            </div>
         </section>
      </div>
   `;

   const statusEl = container.querySelector("#harness-status");
   const feedEl = container.querySelector("#harness-feed");
   const messageEl = container.querySelector("#harness-message");
   const sendButton = container.querySelector("#harness-send");
   const clearButton = container.querySelector("#harness-clear");
   const modeSelect = container.querySelector("#harness-mode");
   const modeNote = container.querySelector("#harness-mode-note");
   const resetButton = container.querySelector("#harness-reset");
   const debugEl = container.querySelector("#harness-debug");
   const commandButton = container.querySelector("#harness-command-send");

   const fields = {
      authorId: container.querySelector("#harness-author-id"),
      authorName: container.querySelector("#harness-author-name"),
      channelId: container.querySelector("#harness-channel-id"),
      channelName: container.querySelector("#harness-channel-name"),
      guildId: container.querySelector("#harness-guild-id"),
      guildName: container.querySelector("#harness-guild-name"),
      scope: container.querySelector("#harness-scope"),
      mentionsBot: container.querySelector("#harness-mentions-bot"),
      isBot: container.querySelector("#harness-is-bot"),
      isSelf: container.querySelector("#harness-is-self"),
      isAdmin: container.querySelector("#harness-is-admin"),
      isOwner: container.querySelector("#harness-is-owner"),
      command: container.querySelector("#harness-command-name"),
      commandOptions: container.querySelector("#harness-command-options")
   };

   const state = {
      mode: "sandbox",
      messages: []
   };

   const renderFeed = () => {
      feedEl.innerHTML = "";
      if (state.messages.length === 0) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No messages yet.";
         feedEl.appendChild(empty);
         return;
      }
      for (const entry of state.messages) {
         const row = document.createElement("div");
         row.className = "chat-row";
         const bubble = document.createElement("div");
         bubble.className = `chat-bubble ${entry.role}`;
         bubble.innerHTML = `
            <div class="chat-meta">${escapeHtml(entry.label)}</div>
            <div class="chat-text">${escapeHtml(entry.text).replace(/\n/g, "<br>")}</div>
         `;
         row.appendChild(bubble);
         feedEl.appendChild(row);
      }
      feedEl.scrollTop = feedEl.scrollHeight;
   };

   const appendMessage = (role, label, text) => {
      state.messages.push({ role, label, text });
      renderFeed();
   };

   const setDebug = (payload) => {
      debugEl.textContent = payload ? JSON.stringify(payload, null, 2) : "";
   };

   const buildMessagePayload = () => ({
      content: messageEl.value.trim(),
      authorId: fields.authorId.value.trim(),
      authorName: fields.authorName.value.trim(),
      channelId: fields.channelId.value.trim(),
      channelName: fields.channelName.value.trim(),
      guildId: fields.guildId.value.trim() || undefined,
      guildName: fields.guildName.value.trim() || undefined,
      scope: fields.scope.value,
      mentionsBot: fields.mentionsBot.checked,
      isBot: fields.isBot.checked,
      isSelf: fields.isSelf.checked,
      isAdmin: fields.isAdmin.checked,
      isBotOwner: fields.isOwner.checked
   });

   const refreshStatus = async () => {
      try {
         const status = await api.get(`/api/harness/status?mode=${state.mode}`);
         if (status.mode === "proxy") {
            if (status.available === false) {
               setStatus(statusEl, status.error || "Proxy unavailable.", "error");
            } else {
               setStatus(statusEl, "Proxy mode: forwarding to running bot.", "success");
            }
         } else if (status.mode === "live") {
            setStatus(statusEl, "Live mode: changes are persistent.", "error");
         } else {
            setStatus(statusEl, "Sandbox mode active.", "success");
         }
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   const handleSendMessage = async () => {
      const payload = buildMessagePayload();
      if (!payload.content) {
         setStatus(statusEl, "Message content is required.", "error");
         return;
      }
      try {
         setStatus(statusEl, "Sending...");
         const result = await api.post(`/api/harness/message?mode=${state.mode}`, { message: payload });
         appendMessage("user", payload.authorName || payload.authorId || "User", payload.content);
         const outgoing = result?.result?.outgoing ?? [];
         outgoing.forEach((entry) => {
            const text = formatOutgoing(entry);
            if (text) appendMessage("bot", "Bot", text);
         });
         setDebug(result?.result);
         setStatus(statusEl, "");
         messageEl.value = "";
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   const handleSendCommand = async () => {
      const command = fields.command.value.trim();
      if (!command) {
         setStatus(statusEl, "Command name is required.", "error");
         return;
      }
      let options = {};
      const rawOptions = fields.commandOptions.value.trim();
      if (rawOptions) {
         try {
            options = JSON.parse(rawOptions);
         } catch (error) {
            setStatus(statusEl, "Options must be valid JSON.", "error");
            return;
         }
      }
      try {
         setStatus(statusEl, "Running command...");
         const payload = {
            command,
            options,
            userId: fields.authorId.value.trim() || "user-1",
            channelId: fields.channelId.value.trim() || "channel-1",
            guildId: fields.guildId.value.trim() || undefined
         };
         const result = await api.post(`/api/harness/command?mode=${state.mode}`, { command: payload });
         appendMessage("system", "Command", `/${command}`);
         const replies = result?.result?.replies ?? [];
         replies.forEach((entry) => {
            const text = formatOutgoing(entry);
            if (text) appendMessage("bot", "Bot", text);
         });
         setDebug(result?.result);
         setStatus(statusEl, "");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   const handleReset = async () => {
      try {
         await api.post(`/api/harness/reset?mode=${state.mode}`);
         state.messages = [];
         renderFeed();
         setDebug(null);
         setStatus(statusEl, "Sandbox reset.", "success");
      } catch (error) {
         const message = error instanceof Error ? error.message : String(error);
         setStatus(statusEl, message, "error");
      }
   };

   sendButton.addEventListener("click", () => {
      void handleSendMessage();
   });
   messageEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
         void handleSendMessage();
      }
   });
   clearButton.addEventListener("click", () => {
      state.messages = [];
      renderFeed();
      setDebug(null);
   });
   commandButton.addEventListener("click", () => {
      void handleSendCommand();
   });
   modeSelect.addEventListener("change", () => {
      state.mode = modeSelect.value === "live" ? "live" : "sandbox";
      if (modeSelect.value === "proxy") {
         state.mode = "proxy";
         modeNote.textContent = "Proxy mode forwards to a running bot and is gated by server config.";
      } else if (modeSelect.value === "live") {
         state.mode = "live";
         modeNote.textContent = "Live mode writes to real data; use with care.";
      } else {
         state.mode = "sandbox";
         modeNote.textContent = "Sandbox mode isolates data in a temp directory.";
      }
      resetButton.disabled = state.mode !== "sandbox";
      void refreshStatus();
   });
   resetButton.addEventListener("click", () => {
      void handleReset();
   });

   resetButton.disabled = false;
   renderFeed();
   await refreshStatus();
}
