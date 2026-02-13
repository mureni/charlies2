import { renderResourcePanel } from "../shared/resourcePanel.js";

export async function render(container, context) {
   await renderResourcePanel(container, context, {
      pluginId: "quotes",
      type: "resources",
      title: "Quotes Resources",
      subtitle: "Manage the quote source files and assets used by the quotes and pray plugins."
   });
}
