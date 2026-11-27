/**
 * Sponsors: one row per tier.
 * Column 1 = tier name (e.g. Gold), column 2 = logos (images, optionally linked).
 * @param {Element} el The block element
 */
export default function init(el) {
  const rows = [...el.querySelectorAll(':scope > div')];

  const tiers = rows.map((row) => {
    const cells = [...row.children];
    const labelCell = cells.length > 1 ? cells[0] : null;
    const logosCell = cells[cells.length - 1];
    const label = labelCell?.textContent.trim();

    const tier = document.createElement('div');
    tier.className = 'sponsors-tier';
    if (label) {
      tier.classList.add(`sponsors-tier-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
      const title = document.createElement('h3');
      title.className = 'sponsors-tier-title';
      title.textContent = label;
      tier.append(title);
    }

    const list = document.createElement('ul');
    list.className = 'sponsors-logos';
    logosCell.querySelectorAll('picture, img:not(picture img)').forEach((media) => {
      const li = document.createElement('li');
      li.append(media.closest('a') || media);
      list.append(li);
    });
    tier.append(list);
    return tier;
  });

  el.replaceChildren(...tiers);
}