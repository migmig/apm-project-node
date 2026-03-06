export function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toLocaleString("ko-KR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0
  });
}

export function formatTime(timestamp) {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour12: false
  });
}
