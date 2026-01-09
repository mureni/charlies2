const navList = document.getElementById("nav-list");
const panel = document.getElementById("panel");

const toast = document.createElement("div");
toast.className = "toast";
document.body.appendChild(toast);

const showToast = (message, tone = "info") => {
   toast.textContent = message;
   toast.dataset.tone = tone;
   toast.classList.add("visible");
   window.clearTimeout(showToast._timer);
   showToast._timer = window.setTimeout(() => {
      toast.classList.remove("visible");
   }, 3200);
};

const requestJson = async (path, options = {}) => {
   const response = await fetch(path, options);
   const text = await response.text();
   let data;
   try {
      data = text ? JSON.parse(text) : {};
   } catch {
      data = { error: text };
   }
   if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`;
      throw new Error(message);
   }
   return data;
};

const api = {
   get: (path) => requestJson(path),
   post: (path, payload) => requestJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {})
   }),
   toast: showToast
};

const themeOptions = [
   { id: "default", label: "Parchment" },
   { id: "harbor", label: "Harbor" },
   { id: "moss", label: "Moss" },
   { id: "dune", label: "Dune" }
];

const themeStorageKey = "adminPortalTheme";

const applyTheme = (themeId) => {
   const resolved = themeId || "default";
   if (resolved === "default") {
      document.documentElement.removeAttribute("data-theme");
   } else {
      document.documentElement.setAttribute("data-theme", resolved);
   }
   try {
      localStorage.setItem(themeStorageKey, resolved);
   } catch {
      // Ignore storage failures.
   }
};

const state = {
   plugins: [],
   modules: new Map(),
   activeId: null,
   buttons: new Map()
};

const setPanelMessage = (title, body) => {
   panel.innerHTML = "";
   const titleEl = document.createElement("div");
   titleEl.className = "panel-title";
   titleEl.textContent = title;
   const bodyEl = document.createElement("div");
   bodyEl.className = "panel-body";
   bodyEl.textContent = body;
   panel.appendChild(titleEl);
   panel.appendChild(bodyEl);
};

const setActiveButton = (id) => {
   for (const [key, button] of state.buttons.entries()) {
      button.classList.toggle("active", key === id);
   }
};

const loadModule = async (plugin) => {
   if (state.modules.has(plugin.id)) return state.modules.get(plugin.id);
   const module = await import(plugin.script);
   if (!module || typeof module.render !== "function") {
      throw new Error(`Plugin ${plugin.id} did not export a render() function`);
   }
   state.modules.set(plugin.id, module);
   return module;
};

const renderPlugin = async (plugin) => {
   state.activeId = plugin.id;
   setActiveButton(plugin.id);
   panel.innerHTML = "";
   const loading = document.createElement("div");
   loading.className = "panel-title";
   loading.textContent = `Loading ${plugin.name}...`;
   panel.appendChild(loading);
   try {
      const module = await loadModule(plugin);
      await module.render(panel, { api, plugin });
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPanelMessage("Unable to load plugin", message);
      showToast(message, "error");
   }
};

const renderSettings = () => {
   state.activeId = "settings";
   setActiveButton("settings");
   panel.innerHTML = `
      <div class="panel-title">Settings</div>
      <div class="panel-subtitle">Customize the admin portal look and feel.</div>
      <div class="grid">
         <section class="card">
            <div class="card-header">
               <div>
                  <h3>Theme</h3>
                  <p class="muted">Pick a palette for the admin portal.</p>
               </div>
            </div>
            <label class="field">
               <span>Theme</span>
               <select id="theme-select">
                  ${themeOptions.map(option => `<option value="${option.id}">${option.label}</option>`).join("")}
               </select>
            </label>
         </section>
      </div>
   `;
   const select = panel.querySelector("#theme-select");
   if (select instanceof HTMLSelectElement) {
      const stored = (() => {
         try {
            return localStorage.getItem(themeStorageKey);
         } catch {
            return null;
         }
      })();
      const current = document.documentElement.getAttribute("data-theme") || "default";
      select.value = stored || current || "default";
      select.addEventListener("change", () => {
         applyTheme(select.value);
      });
   }
};

const buildNav = (plugins) => {
   navList.innerHTML = "";
   state.buttons.clear();
   for (const plugin of plugins) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = plugin.name;
      button.addEventListener("click", () => {
         void renderPlugin(plugin);
      });
      navList.appendChild(button);
      state.buttons.set(plugin.id, button);
   }
   const settingsButton = document.createElement("button");
   settingsButton.type = "button";
   settingsButton.textContent = "Settings";
   settingsButton.addEventListener("click", () => {
      renderSettings();
   });
   navList.appendChild(settingsButton);
   state.buttons.set("settings", settingsButton);
};

const init = async () => {
   try {
      const storedTheme = (() => {
         try {
            return localStorage.getItem(themeStorageKey);
         } catch {
            return null;
         }
      })();
      applyTheme(storedTheme || "default");
      const result = await api.get("/api/plugins");
      state.plugins = result.plugins ?? [];
      if (state.plugins.length === 0) {
         setPanelMessage("No plugins", "No admin panels are registered yet.");
         return;
      }
      buildNav(state.plugins);
      void renderPlugin(state.plugins[0]);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPanelMessage("Unable to load admin portal", message);
      showToast(message, "error");
   }
};

void init();
