export const formatTimestamp = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  const ms =
    typeof value === "number"
      ? (value < 1e12 ? value * 1000 : value)
      : Date.parse(String(value));
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
};

export const formatConfidence = (value: unknown): number | null => {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || Number.isNaN(num)) return null;
  return num > 1 ? num / 100 : num;
};