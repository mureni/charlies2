import { renderResourcePanel } from "../shared/resourcePanel.js";

export async function render(container, context) {
   await renderResourcePanel(container, context, {
      pluginId: "tarot",
      type: "resources",
      title: "Tarot Resources",
      subtitle: "Manage tarot decks, layouts, themes, and defaults."
   });
}
