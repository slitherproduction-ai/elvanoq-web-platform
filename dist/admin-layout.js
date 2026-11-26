(() => {
  if (document.body.dataset.view !== 'panel') return;
  const root = document.querySelector('.panel-workspace');
  if (!root) return;
  const controls = 'input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea';
  function arrange() {
    for (const content of root.querySelectorAll('.device-expanded')) {
      const items = [...content.children].filter(el => ['STRONG','SPAN','SMALL'].includes(el.tagName));
      if (items.length) {
        let group = content.querySelector(':scope > .device-meta-grid');
        if (!group) { group = document.createElement('div'); group.className = 'device-meta-grid'; items[0].before(group); }
        group.append(...items);
      }
    }
    for (const form of root.querySelectorAll('form')) {
      if (!form.classList.contains('panel-form-grid')) form.classList.add('panel-form-grid');
      for (const label of [...form.children].filter(el => el.tagName === 'LABEL' && !el.classList.contains('check-label'))) {
        let control = label.querySelector(controls);
        if (control) {
          if (!label.classList.contains('panel-form-field')) label.classList.add('panel-form-field');
          continue;
        }
        control = label.htmlFor ? document.getElementById(label.htmlFor) : null;
        if (!control || control.parentElement !== form) continue;
        const field = document.createElement('div');
        field.className = 'panel-form-field';
        label.before(field);
        field.append(label, control);
      }
      form.classList.toggle('panel-form-single', form.querySelectorAll(':scope > .panel-form-field').length === 1);
      const owner = form.querySelector('#resellerSelectWrap');
      if (owner && !owner.classList.contains('panel-form-field')) owner.classList.add('panel-form-field');
      for (const field of form.querySelectorAll(':scope > .panel-form-field')) {
        const control = field.querySelector(controls), label = field.querySelector('label');
        if (!control) continue;
        // Preserve the original platform visibility and required/disabled state.
        if (field.id !== 'resellerSelectWrap' && field.tagName !== 'LABEL') {
          const hidden = control.hidden || !!label?.hidden;
          if (field.hidden !== hidden) field.hidden = hidden;
        }
        const wide = control.tagName === 'TEXTAREA' || control.type === 'file';
        if (field.classList.contains('panel-form-wide') !== wide) field.classList.toggle('panel-form-wide', wide);
      }
    }
  }
  arrange();
  new MutationObserver(arrange).observe(root, {
    childList:true, subtree:true, attributes:true, attributeFilter:['hidden']
  });
})();
