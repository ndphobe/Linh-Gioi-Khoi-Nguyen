export const REGIONS = Object.freeze([
  { id: 'sect_hall', name: 'Sảnh Điện Tu Tiên', level: 'Luyện Khí Cấp 1', requiredOrder: 0, mapOrder: 0, portal: { x: 0, z: 26 }, townGate: { x: 0, z: 26 }, marker: { x: 45, y: 45 } },
  { id: 'luoyang', name: 'Lạc Dương Thành', level: 'Trúc Cơ Cấp 1', requiredOrder: 1, mapOrder: 1, portal: { x: 28, z: -8 }, townGate: { x: 25, z: -5 }, marker: { x: 67, y: 36 } },
  { id: 'spirit_mine', name: 'Mỏ Linh Thạch', level: 'Trúc Cơ Cấp 3', requiredOrder: 1, mapOrder: 2, portal: { x: 18, z: 34 }, townGate: { x: 16, z: 31 }, marker: { x: 61, y: 77 } },
  { id: 'heaven_sect', name: 'Thiên Vân Môn', level: 'Kim Đan Cấp 1', requiredOrder: 2, mapOrder: 3, portal: { x: -30, z: -18 }, townGate: { x: -27, z: -16 }, marker: { x: 26, y: 31 } },
]);

export class MapManager {
  constructor({ overlay, realmOrder = 0, currentRegion = 'sect_hall', onTeleport, onClose }) {
    this.overlay = overlay; this.realmOrder = realmOrder; this.currentRegion = currentRegion;
    this.onTeleport = onTeleport; this.onClose = onClose; this.popup = null;
    this.bindNodes(); this.createMarker();
  }
  bindNodes() {
    const nodes = [...(this.overlay?.querySelectorAll('.map-location') ?? [])];
    nodes.forEach((node, index) => { const region = REGIONS[index]; if (!region) return; node.dataset.regionId = region.id; const locked = !this.isUnlocked(region); node.classList.toggle('map-location--locked', locked); node.classList.toggle('map-location--active', region.id === this.currentRegion); const text = node.querySelector('text'); if (text) text.textContent = `${locked ? '🔒 ' : ''}${region.name}`; node.setAttribute('tabindex', '0'); node.onclick = () => this.select(region, node); node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') this.select(region, node); }; });
  }
  isUnlocked(region) { return this.realmOrder >= region.requiredOrder; }
  select(region, anchor) {
    this.popup?.remove();
    const popup = document.createElement('div'); popup.className = 'map-travel-popup';
    const unlocked = this.isUnlocked(region);
    popup.innerHTML = `<button class="map-popup-close" aria-label="Đóng">×</button><small>KHU VỰC</small><h3>${region.name}</h3><p>Yêu cầu: <b>${region.level}</b></p>${unlocked ? '<button class="map-teleport">Dịch Chuyển</button>' : '<button disabled>🔒 Chưa đủ cảnh giới</button>'}`;
    this.overlay.querySelector('.map-scroll')?.appendChild(popup); this.popup = popup;
    popup.querySelector('.map-popup-close').onclick = () => { popup.remove(); this.popup = null; };
    popup.querySelector('.map-teleport')?.addEventListener('click', () => this.teleport(region));
    anchor.classList.remove('is-pulsing'); requestAnimationFrame(() => anchor.classList.add('is-pulsing'));
  }
  teleport(region) { const target = region.id === this.currentRegion ? region.portal : region.townGate; this.currentRegion = region.id; this.onTeleport?.({ ...target }, region); this.popup?.remove(); this.popup = null; this.updateMarker(); this.bindNodes(); this.onClose?.(); }
  createMarker() { if (!this.overlay) return; this.marker = document.createElement('div'); this.marker.className = 'map-player-pin'; this.marker.innerHTML = '<i>⚔</i><span>Vị trí</span>'; this.overlay.querySelector('.map-canvas')?.appendChild(this.marker); this.updateMarker(); }
  updateMarker() { const region = REGIONS.find(item => item.id === this.currentRegion) ?? REGIONS[0]; if (this.marker) { this.marker.style.left = `${region.marker.x}%`; this.marker.style.top = `${region.marker.y}%`; const label=this.marker.querySelector('span');if(label)label.textContent=`Bạn đang ở: ${region.name}`; } const heading=this.overlay?.querySelector('.overlay-heading p');if(heading)heading.innerHTML=`Vị trí hiện tại: <b>${region.name}</b> · Nhấn <kbd>M</kbd> hoặc <kbd>Esc</kbd> để thu bản đồ`; }
  setRealmOrder(order) { this.realmOrder = Math.max(0, Number(order) || 0); this.bindNodes(); }
  destroy() { this.popup?.remove(); this.marker?.remove(); }
}
