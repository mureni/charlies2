export const formatBytes = (bytes) => {
   if (!bytes || bytes <= 0) return "0 B";
   const units = ["B", "KB", "MB", "GB"];
   let index = 0;
   let value = bytes;
   while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
   }
   return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
};

export const scopeLabel = (scope) => {
   if (scope === "community") return "Community";
   if (scope === "conversation") return "Conversation";
   return "Global";
};
