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

const scopeLabels = {
   user: "User",
   group: "Group",
   guild: "Server",
   channel: "Channel"
};

const formatRuleLabel = (rule) => {
   const replacement = rule.replacement || "<blank>";
   const flags = [
      rule.applyLearn ? "learn" : null,
      rule.applyRespond ? "respond" : null
   ].filter(Boolean).join("/") || "disabled";
   const mode = rule.mode === "regex" ? "regex" : "word";
   const caseFlag = rule.caseSensitive ? "case" : "nocase";
   return `${replacement} (${mode}, ${caseFlag}, ${flags})`;
};

const serializeRule = (form) => ({
   id: form.dataset.ruleId || undefined,
   scope: form.querySelector("[name='scope']").value,
   scopeId: form.querySelector("[name='scopeId']").value.trim(),
   pattern: form.querySelector("[name='pattern']").value.trim(),
   replacement: form.querySelector("[name='replacement']").value.trim(),
   mode: form.querySelector("[name='mode']").value,
   caseSensitive: form.querySelector("[name='caseSensitive']").value === "true",
   applyLearn: form.querySelector("[name='applyLearn']").checked,
   applyRespond: form.querySelector("[name='applyRespond']").checked,
   enabled: form.querySelector("[name='enabled']").checked
});

const clearRuleForm = (form) => {
   form.dataset.ruleId = "";
   form.querySelector("[name='scope']").value = "user";
   form.querySelector("[name='scopeId']").value = "";
   form.querySelector("[name='pattern']").value = "";
   form.querySelector("[name='replacement']").value = "";
   form.querySelector("[name='mode']").value = "word";
   form.querySelector("[name='caseSensitive']").value = "false";
   form.querySelector("[name='applyLearn']").checked = true;
   form.querySelector("[name='applyRespond']").checked = true;
   form.querySelector("[name='enabled']").checked = true;
};

const renderRuleList = (listEl, rules, activeId) => {
   listEl.innerHTML = "";
   if (!rules.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No swap rules yet.";
      listEl.appendChild(empty);
      return;
   }
   for (const rule of rules) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item";
      button.dataset.ruleId = rule.id;
      if (rule.id === activeId) button.classList.add("active");
      button.innerHTML = `
         <div class="list-title">
            <span>${rule.pattern} -> ${rule.replacement || "<blank>"}</span>
            <span class="badge">${scopeLabels[rule.scope] || rule.scope}</span>
         </div>
         <div class="muted">${rule.scopeId}</div>
         <div class="muted">${formatRuleLabel(rule)}</div>
      `;
      listEl.appendChild(button);
   }
};

export async function render(container, context) {
   const { api } = context;
   container.innerHTML = `
      <div class="panel-title">Swaps</div>
      <div class="panel-subtitle">Define swap filters by scope, then decide whether they apply to learning, responses, or both.</div>
      <div class="status" id="swaps-status"></div>
      <div class="grid two-col">
         <section class="card" id="swaps-rules-card">
            <div class="card-header">
               <div>
                  <h3>Swap Rules</h3>
                  <p class="muted">Precedence: user, group, server, channel.</p>
               </div>
               <button class="button ghost" type="button" data-action="refresh-rules">Refresh</button>
            </div>
            <input id="swaps-rule-search" type="search" placeholder="Search pattern, replacement, or scope id">
            <div class="list" id="swaps-rule-list"></div>
         </section>
         <section class="card" id="swaps-editor-card">
            <div class="card-header">
               <div>
                  <h3>Rule Editor</h3>
                  <p class="muted">Create or update swap rules. Use regex mode for advanced matching.</p>
               </div>
               <button class="button ghost" type="button" data-action="clear-rule">Clear</button>
            </div>
            <form id="swaps-rule-form" class="meta-grid">
               <label class="field">
                  <span>Scope</span>
                  <select name="scope">
                     <option value="user">User</option>
                     <option value="group">Group</option>
                     <option value="guild">Server</option>
                     <option value="channel">Channel</option>
                  </select>
               </label>
               <label class="field">
                  <span>Scope Id</span>
                  <input name="scopeId" type="text" placeholder="user id / group id / guild id / channel id">
               </label>
               <label class="field">
                  <span>Pattern</span>
                  <input name="pattern" type="text" placeholder="fudge">
               </label>
               <label class="field">
                  <span>Replacement</span>
                  <input name="replacement" type="text" placeholder="frick">
               </label>
               <label class="field">
                  <span>Mode</span>
                  <select name="mode">
                     <option value="word">Whole word</option>
                     <option value="regex">Regex</option>
                  </select>
               </label>
               <label class="field">
                  <span>Case</span>
                  <select name="caseSensitive">
                     <option value="false">Insensitive</option>
                     <option value="true">Sensitive</option>
                  </select>
               </label>
               <label class="field compact">
                  <span>Apply on learn</span>
                  <input name="applyLearn" type="checkbox" checked>
               </label>
               <label class="field compact">
                  <span>Apply on respond</span>
                  <input name="applyRespond" type="checkbox" checked>
               </label>
               <label class="field compact">
                  <span>Enabled</span>
                  <input name="enabled" type="checkbox" checked>
               </label>
               <div class="actions">
                  <button class="button" type="button" data-action="save-rule">Save rule</button>
                  <button class="button ghost" type="button" data-action="delete-rule">Delete rule</button>
               </div>
            </form>
         </section>
      </div>
      <section class="card" id="swaps-groups-card">
         <div class="card-header">
            <div>
               <h3>Groups / Cliques</h3>
               <p class="muted">Define cross-server cliques that can override server-level swaps.</p>
            </div>
            <button class="button ghost" type="button" data-action="refresh-groups">Refresh</button>
         </div>
         <div class="grid two-col">
            <div>
               <div class="list" id="swaps-group-list"></div>
            </div>
            <div id="swaps-group-detail" class="detail-body"></div>
         </div>
         <details class="detail">
            <summary>New group</summary>
            <div class="meta-grid">
               <label class="field">
                  <span>Group Id</span>
                  <input id="swaps-new-group-id" type="text" placeholder="clique-1">
               </label>
               <label class="field">
                  <span>Name</span>
                  <input id="swaps-new-group-name" type="text" placeholder="Writers room">
               </label>
               <label class="field">
                  <span>Notes</span>
                  <textarea id="swaps-new-group-notes" placeholder="Short description"></textarea>
               </label>
            </div>
            <div class="actions">
               <button class="button" type="button" data-action="create-group">Create group</button>
            </div>
         </details>
      </section>
   `;

   const statusEl = container.querySelector("#swaps-status");
   const searchEl = container.querySelector("#swaps-rule-search");
   const listEl = container.querySelector("#swaps-rule-list");
   const formEl = container.querySelector("#swaps-rule-form");
   const groupsListEl = container.querySelector("#swaps-group-list");
   const groupDetailEl = container.querySelector("#swaps-group-detail");
   const newGroupId = container.querySelector("#swaps-new-group-id");
   const newGroupName = container.querySelector("#swaps-new-group-name");
   const newGroupNotes = container.querySelector("#swaps-new-group-notes");

   const state = {
      rules: [],
      groups: [],
      activeRuleId: null,
      activeGroupId: null
   };

   const refreshRules = async () => {
      const query = searchEl.value.trim();
      const params = query ? `?q=${encodeURIComponent(query)}` : "";
      const result = await api.get(`/api/swaps/rules${params}`);
      state.rules = result.rules ?? [];
      renderRuleList(listEl, state.rules, state.activeRuleId);
   };

   const refreshGroups = async () => {
      const result = await api.get("/api/swaps/groups");
      state.groups = result.groups ?? [];
      renderGroupList();
   };

   const renderGroupDetail = (group) => {
      if (!group) {
         groupDetailEl.innerHTML = "<div class=\"empty\">Select a group to view members.</div>";
         return;
      }
      const members = group.members || [];
      groupDetailEl.innerHTML = `
         <div class="detail-title">${group.name}</div>
         <div class="muted">${group.id}</div>
            <div class="muted">${group.notes || ""}</div>
         <div class="list">
            ${members.length === 0 ? "<div class=\"empty\">No members yet.</div>" : members.map(member => `
               <div class="list-item" data-member="${member}">
                  <div class="list-title">
                     <span>${member}</span>
                     <button class="button ghost small" type="button" data-action="remove-member">Remove</button>
                  </div>
               </div>
            `).join("")}
         </div>
         <div class="actions">
            <input id="swaps-new-member" type="text" placeholder="member id">
            <button class="button" type="button" data-action="add-member">Add member</button>
            <button class="button ghost" type="button" data-action="delete-group">Delete group</button>
         </div>
      `;

      const addButton = groupDetailEl.querySelector("[data-action='add-member']");
      const deleteButton = groupDetailEl.querySelector("[data-action='delete-group']");
      const input = groupDetailEl.querySelector("#swaps-new-member");
      addButton.addEventListener("click", async () => {
         const memberId = input.value.trim();
         if (!memberId) return;
         await api.post("/api/swaps/group/member", { groupId: group.id, memberId, action: "add" });
         input.value = "";
         await refreshGroups();
         renderGroupDetail(state.groups.find(item => item.id === group.id));
      });
      deleteButton.addEventListener("click", async () => {
         await api.post("/api/swaps/group", { id: group.id, action: "delete" });
         state.activeGroupId = null;
         await refreshGroups();
         renderGroupDetail(null);
      });
      groupDetailEl.querySelectorAll("[data-action='remove-member']").forEach((button) => {
         button.addEventListener("click", async (event) => {
            const item = event.target.closest(".list-item");
            const memberId = item?.dataset.member;
            if (!memberId) return;
            await api.post("/api/swaps/group/member", { groupId: group.id, memberId, action: "remove" });
            await refreshGroups();
            renderGroupDetail(state.groups.find(entry => entry.id === group.id));
         });
      });
   };

   const renderGroupList = () => {
      groupsListEl.innerHTML = "";
      if (!state.groups.length) {
         const empty = document.createElement("div");
         empty.className = "empty";
         empty.textContent = "No groups defined.";
         groupsListEl.appendChild(empty);
         renderGroupDetail(null);
         return;
      }
      for (const group of state.groups) {
         const button = document.createElement("button");
         button.type = "button";
         button.className = "list-item";
         if (group.id === state.activeGroupId) button.classList.add("active");
         button.innerHTML = `
            <div class="list-title">
               <span>${group.name}</span>
               <span class="badge">${group.members?.length ?? 0}</span>
            </div>
            <div class="muted">${group.id}</div>
         `;
         button.addEventListener("click", () => {
            state.activeGroupId = group.id;
            renderGroupList();
            renderGroupDetail(group);
         });
         groupsListEl.appendChild(button);
      }
      const active = state.groups.find(group => group.id === state.activeGroupId);
      renderGroupDetail(active ?? state.groups[0]);
   };

   listEl.addEventListener("click", (event) => {
      const target = event.target.closest(".list-item");
      if (!target) return;
      const ruleId = target.dataset.ruleId;
      const rule = state.rules.find(item => item.id === ruleId);
      if (!rule) return;
      state.activeRuleId = rule.id;
      formEl.dataset.ruleId = rule.id;
      formEl.querySelector("[name='scope']").value = rule.scope;
      formEl.querySelector("[name='scopeId']").value = rule.scopeId;
      formEl.querySelector("[name='pattern']").value = rule.pattern;
      formEl.querySelector("[name='replacement']").value = rule.replacement;
      formEl.querySelector("[name='mode']").value = rule.mode;
      formEl.querySelector("[name='caseSensitive']").value = rule.caseSensitive ? "true" : "false";
      formEl.querySelector("[name='applyLearn']").checked = Boolean(rule.applyLearn);
      formEl.querySelector("[name='applyRespond']").checked = Boolean(rule.applyRespond);
      formEl.querySelector("[name='enabled']").checked = Boolean(rule.enabled);
      renderRuleList(listEl, state.rules, state.activeRuleId);
   });

   container.querySelector("[data-action='refresh-rules']").addEventListener("click", () => refreshRules());
   container.querySelector("[data-action='refresh-groups']").addEventListener("click", () => refreshGroups());
   container.querySelector("[data-action='clear-rule']").addEventListener("click", () => {
      state.activeRuleId = null;
      clearRuleForm(formEl);
      renderRuleList(listEl, state.rules, null);
   });
   container.querySelector("[data-action='save-rule']").addEventListener("click", async () => {
      const payload = serializeRule(formEl);
      const result = await api.post("/api/swaps/rule", payload);
      if (result?.rule?.id) {
         state.activeRuleId = result.rule.id;
      }
      await refreshRules();
      setStatus(statusEl, "Rule saved.", "success");
   });
   container.querySelector("[data-action='delete-rule']").addEventListener("click", async () => {
      const payload = serializeRule(formEl);
      if (!payload.id) {
         setStatus(statusEl, "Select a rule to delete.", "warn");
         return;
      }
      await api.post("/api/swaps/rule", { action: "delete", id: payload.id, scope: payload.scope, scopeId: payload.scopeId });
      state.activeRuleId = null;
      clearRuleForm(formEl);
      await refreshRules();
      setStatus(statusEl, "Rule removed.", "success");
   });
   container.querySelector("[data-action='create-group']").addEventListener("click", async () => {
      const payload = {
         id: newGroupId.value.trim(),
         name: newGroupName.value.trim(),
         notes: newGroupNotes.value.trim()
      };
      if (!payload.id || !payload.name) {
         setStatus(statusEl, "Group id and name are required.", "warn");
         return;
      }
      await api.post("/api/swaps/group", payload);
      newGroupId.value = "";
      newGroupName.value = "";
      newGroupNotes.value = "";
      await refreshGroups();
      setStatus(statusEl, "Group saved.", "success");
   });

   searchEl.addEventListener("input", () => refreshRules());

   clearRuleForm(formEl);
   try {
      await Promise.all([refreshRules(), refreshGroups()]);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(statusEl, message, "error");
   }
}
