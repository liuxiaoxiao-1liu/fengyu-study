let toastTimer: number | undefined;

export function showToast(message: string) {
  const toast = document.getElementById('toast-success');
  if (!toast) return;
  if (message) {
    const span = toast.querySelector('.font-body-sm');
    if (span) span.textContent = message;
  }
  toast.classList.remove('hidden');
  toast.classList.add('toast-enter');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.add('hidden'), 4500);
}

export function hideToast() {
  document.getElementById('toast-success')?.classList.add('hidden');
}
