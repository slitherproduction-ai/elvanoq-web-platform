(() => {
  const groups = new WeakMap();
  const active = new WeakSet();
  const make = (tag, text = '') => {
    const el = document.createElement(tag);
    el.textContent = text;
    return el;
  };
  const button = text => { const el = make('button', text); el.type = 'button'; return el; };
  function mount(list, entries, actions, refresh) {
    groups.get(list)?.bar.remove();
    if (!entries.length) { groups.delete(list); return; }
    const bar = make('div'), count = make('span'), status = make('p'), review = make('div');
    bar.className = 'panel-bulk';
    status.setAttribute('role', 'status');
    review.className = 'panel-bulk-review';
    review.hidden = true;
    const all = make('input'), allLabel = make('label', 'Selecionar todos desta página');
    all.type = 'checkbox';
    allLabel.prepend(all);
    const select = make('select'), selectLabel = make('label', 'Ação em lote');
    selectLabel.append(select);
    select.append(new Option('Escolha uma ação', ''));
    actions.forEach((action, i) => select.append(new Option(action.title, String(i))));
    const next = button('Revisar ação'), clear = button('Limpar seleção');
    const deletion = actions.find(action => action.directDelete);
    const remove = button('Excluir selecionados');
    remove.className = 'danger-button';
    remove.hidden = !deletion;
    const toolbar = make('div');
    toolbar.className = 'panel-bulk-controls';
    toolbar.append(allLabel, count, selectLabel, next, clear, remove);
    bar.append(toolbar, review, status);
    list.before(bar);
    for (const entry of entries) {
      const name = 'Selecionar ' + entry.name;
      const label = make('label', deletion ? '' : name), input = make('input');
      if (deletion) { input.setAttribute('aria-label', name); label.title = name; }
      input.type = 'checkbox';
      label.className = 'panel-bulk-item';
      label.prepend(input);
      entry.row.prepend(label);
      entry.input = input;
      input.addEventListener('change', () => sync(true));
    }
    const visible = () => entries.filter(entry => !entry.row.hidden);
    const checked = () => visible().filter(entry => entry.input.checked);
    function sync(invalidate = false) {
      if (invalidate && !active.has(list)) review.hidden = true;
      entries.filter(entry => entry.row.hidden).forEach(entry => { entry.input.checked = false; });
      const rows = visible(), selected = checked(), busy = active.has(list);
      all.disabled = busy || !rows.length;
      all.checked = !!rows.length && selected.length === rows.length;
      all.indeterminate = selected.length > 0 && selected.length < rows.length;
      count.textContent = selected.length + ' de ' + rows.length + ' selecionados';
      entries.forEach(entry => { entry.input.disabled = busy; });
      select.disabled = busy || !selected.length;
      clear.disabled = busy || !selected.length;
      next.disabled = busy || !selected.length || select.value === '';
      remove.disabled = busy || !deletion || !selected.some(entry => deletion.eligible(entry));
    }
    all.addEventListener('change', () => { visible().forEach(entry => { entry.input.checked = all.checked; }); sync(true); });
    clear.addEventListener('click', () => { entries.forEach(entry => { entry.input.checked = false; }); sync(true); });
    select.addEventListener('change', () => sync(true));
    function openReview(action, trigger) {
      const selected = checked();
      if (!action || !selected.length || active.has(list)) return;
      const targets = selected.filter(action.eligible);
      const skipped = selected.length - targets.length;
      review.replaceChildren(make('p', action.title + ': ' + targets.length + ' item(ns) elegível(is).' + (skipped ? ' ' + skipped + ' fora desta ação.' : '')));
      review.hidden = false;
      if (!targets.length) return;
      if (action.warning) review.append(make('p', action.warning));
      const sample = make('p', targets.slice(0, 8).map(entry => entry.name).join(' · ') + (targets.length > 8 ? ' · e mais ' + (targets.length - 8) : ''));
      const yes = button(action.destructive ? 'Confirmar exclusão definitiva' : 'Confirmar ação'), no = button('Cancelar');
      if (action.destructive) yes.className = 'danger-button';
      review.append(sample, yes, no);
      no.addEventListener('click', () => { review.hidden = true; trigger.focus(); });
      no.focus();
      yes.addEventListener('click', async () => {
        if (review.hidden || active.has(list) || !bar.isConnected) return;
        active.add(list);
        review.hidden = true;
        list.inert = true;
        sync();
        let done = 0;
        const failures = [];
        try {
          for (const [i, entry] of targets.entries()) {
            status.textContent = 'Processando ' + (i + 1) + ' de ' + targets.length + '…';
            try { await action.run(entry); done++; }
            catch (error) {
              failures.push(entry.name + ': ' + error.message);
              if (error.status === 429 || error.status === 401 || error.name === 'TimeoutError' || error.name === 'AbortError') break;
            }
          }
        } finally {
          active.delete(list);
          list.inert = false;
          entries.forEach(entry => { entry.input.checked = false; });
          sync();
        }
        let result = done + ' concluído(s), ' + failures.length + ' sem confirmação' +
          (targets.length > done + failures.length ? ', ' + (targets.length - done - failures.length) + ' não processado(s)' : '') + '.';
        if (failures.length) result += ' ' + failures.slice(0, 5).join(' | ');
        try { await refresh(); } catch { result += ' Não foi possível atualizar a lista. Recarregue antes de repetir a ação.'; }
        (groups.get(list)?.status || status).textContent = result;
        if (!groups.has(list)) list.before(status);
      });
    }
    next.addEventListener('click', () => { if (select.value !== '') openReview(actions[Number(select.value)], next); });
    remove.addEventListener('click', () => openReview(deletion, remove));
    groups.set(list, { bar, status, sync });
    sync();
  }
  window.ELVANOQ_BULK = { mount, update: list => groups.get(list)?.sync(true) };
})();
