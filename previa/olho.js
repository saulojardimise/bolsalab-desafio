// Põe o "olho" (mostrar/esconder) em todos os campos de senha da página.
(function () {
  const ABERTO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const FECHADO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 7.5A16.7 16.7 0 0 0 2.5 12S6 18 12 18a9.3 9.3 0 0 0 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function equipar(campo) {
    if (campo.dataset.olho) return;
    campo.dataset.olho = '1';
    const caixa = document.createElement('span');
    caixa.className = 'campo-senha';
    campo.replaceWith(caixa);
    caixa.append(campo);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'campo-senha-olho';
    const pintar = () => {
      const ver = campo.type === 'text';
      b.innerHTML = ver ? FECHADO : ABERTO;
      b.setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha');
      b.setAttribute('aria-pressed', String(ver));
    };
    b.addEventListener('click', () => { campo.type = campo.type === 'password' ? 'text' : 'password'; pintar(); campo.focus(); });
    pintar();
    caixa.append(b);
  }
  const varrer = () => document.querySelectorAll('input[type=password]:not([data-olho])').forEach(equipar);
  new MutationObserver(varrer).observe(document.documentElement, { childList: true, subtree: true });
  varrer();
})();
