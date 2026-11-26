(() => {
  const nav = document.getElementById('portal-main-nav');
  const button = document.querySelector('.portal-menu');
  if (!nav || !button || !window.matchMedia) return;
  const header = nav.closest('header');
  const compact = window.matchMedia('(max-width: 1100px)');
  const setOpen = open => {
    nav.hidden = compact.matches && !open;
    button.setAttribute('aria-expanded', String(compact.matches && open));
  };
  const sync = () => {
    const hadNavFocus = nav.contains(document.activeElement);
    const hadButtonFocus = document.activeElement === button;
    button.hidden = !compact.matches;
    setOpen(false);
    if (compact.matches && hadNavFocus) button.focus();
    if (!compact.matches && hadButtonFocus) nav.querySelector('a')?.focus();
  };
  header.setAttribute('data-portal-menu', '');
  button.addEventListener('click', () => setOpen(nav.hidden));
  header.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  compact.addEventListener('change', sync);
  sync();
})();
