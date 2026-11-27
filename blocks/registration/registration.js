/**
 * Registration (POC placeholder).
 * Row 1 = form area (placeholder until the registration service is connected).
 * Row 2 = waitlist message, shown in a modal when the event is full.
 *
 * For demos, add ?waitlist to the page URL to open the waitlist dialog.
 * @param {Element} el The block element
 */

let dialogCount = 0;

function buildWaitlistDialog(messageCell) {
  dialogCount += 1;
  const messageId = `registration-waitlist-message-${dialogCount}`;

  const dialog = document.createElement('dialog');
  dialog.className = 'registration-waitlist';
  dialog.setAttribute('aria-labelledby', messageId);

  const form = document.createElement('form');
  form.method = 'dialog';

  const message = document.createElement('div');
  message.id = messageId;
  message.className = 'registration-waitlist-message';
  message.append(...messageCell.childNodes);

  const actions = document.createElement('p');
  actions.className = 'registration-waitlist-actions btn-group';
  // Labels are fixed for the POC; move them to placeholders when localising
  const button = (label, value, variant) => {
    const btn = document.createElement('button');
    btn.className = `btn ${variant}`;
    btn.value = value;
    btn.textContent = label;
    return btn;
  };
  const ok = button('OK', 'ok', 'btn-primary');
  ok.autofocus = true;
  actions.append(button('Cancel', 'cancel', 'btn-secondary'), ok);

  form.append(message, actions);
  dialog.append(form);

  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'ok') return;
    // POC: simulate joining the waitlist. The registration service replaces this.
    window.location.href = './waitlistregthankyou';
  });
  return dialog;
}

export default function init(el) {
  const [formRow, waitlistRow] = el.querySelectorAll(':scope > div');

  const formArea = document.createElement('div');
  formArea.className = 'registration-form';
  formArea.dataset.status = 'placeholder';
  formArea.setAttribute('role', 'region');
  formArea.setAttribute('aria-label', 'Registration form');
  const formCell = formRow?.querySelector(':scope > div');
  if (formCell) formArea.append(...formCell.childNodes);

  const children = [formArea];
  const messageCell = waitlistRow?.querySelector(':scope > div');
  let dialog;
  if (messageCell?.textContent.trim()) {
    dialog = buildWaitlistDialog(messageCell);
    children.push(dialog);
  }

  el.replaceChildren(...children);

  // Lets the registration service (later) open the dialog: el.openWaitlist()
  el.openWaitlist = () => dialog?.showModal();

  const { searchParams } = new URL(window.location.href);
  if (dialog && searchParams.has('waitlist')) dialog.showModal();
}