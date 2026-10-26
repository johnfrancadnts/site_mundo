const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let photos = [];
let photoIndex = 0;
let property = null;
function showError(message) { $('loading').classList.add('hidden'); $('property-page').classList.add('hidden'); $('error').classList.remove('hidden'); $('error-message').textContent = message; }
function paintGallery() {
  if (!photos.length) photos = [''];
  const gallery = $('gallery');
  gallery.innerHTML = photos.slice(0,5).map((src,i) => `<button class="gallery-tile" type="button" data-photo="${i}" aria-label="Ampliar foto ${i+1}"><img src="${esc(src)}" alt="Foto ${i+1} de ${esc(property?.title || 'imóvel')}" loading="${i===0?'eager':'lazy'}"><span class="gallery-overlay"></span></button>`).join('');
  gallery.querySelectorAll('[data-photo]').forEach(el => el.addEventListener('click', () => openGallery(Number(el.dataset.photo))));
  $('show-photos').classList.toggle('hidden', photos.length < 2);
  $('show-photos').addEventListener('click', () => openGallery(0), {once:true});
  paintModal();
}
function paintModal() {
  $('modal-image').src = photos[photoIndex] || '';
  $('modal-count').textContent = `Foto ${photoIndex + 1} de ${photos.length}`;
  $('modal-prev').classList.toggle('hidden', photos.length < 2);
  $('modal-next').classList.toggle('hidden', photos.length < 2);
  $('modal-thumbs').innerHTML = photos.length > 1 ? photos.map((src,i) => `<img src="${esc(src)}" alt="Miniatura ${i+1}" data-modal-photo="${i}" class="${i===photoIndex?'active':''}">`).join('') : '';
  $('modal-thumbs').querySelectorAll('[data-modal-photo]').forEach(el => el.addEventListener('click', () => { photoIndex = Number(el.dataset.modalPhoto); paintModal(); }));
}
function openGallery(index=0) { photoIndex = Math.max(0, Math.min(index, photos.length-1)); paintModal(); $('photo-modal').classList.add('open'); document.body.style.overflow='hidden'; $('modal-close').focus(); }
function closeGallery() { $('photo-modal').classList.remove('open'); document.body.style.overflow=''; }
function changePhoto(step) { if (!photos.length) return; photoIndex = (photoIndex + step + photos.length) % photos.length; paintModal(); }
$('modal-prev').addEventListener('click', () => changePhoto(-1));
$('modal-next').addEventListener('click', () => changePhoto(1));
$('modal-close').addEventListener('click', closeGallery);
$('photo-modal').addEventListener('click', e => { if (e.target === $('photo-modal')) closeGallery(); });
document.addEventListener('keydown', e => { if (!$('photo-modal').classList.contains('open')) return; if (e.key === 'Escape') closeGallery(); if (e.key === 'ArrowLeft') changePhoto(-1); if (e.key === 'ArrowRight') changePhoto(1); });
(async function init() {
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { showError('O link não contém o código do imóvel.'); return; }
    await window.firebaseBridgeReady;
    const bridge = window.firebaseBridge;
    const all = await bridge.loadProperties();
    property = all.find(item => item.id === id);
    const p = property;
    if (!p) { showError('Este anúncio não foi encontrado. Ele pode ter sido removido.'); return; }
    const cfg = { venda:{label:'VENDA',color:'#00e6a8'}, aluguel:{label:'ALUGUEL',color:'#38bdf8'}, lazer:{label:'ÁREA DE LAZER',color:'#eab308'} }[p.type] || {label:p.typeLabel || 'IMÓVEL',color:'#00e6a8'};
    $('type-badge').innerHTML = `<i class="fa-solid fa-house"></i>${esc(p.typeLabel || cfg.label)}`; $('type-badge').style.color = cfg.color; $('type-badge').style.borderColor = cfg.color;
    $('title').textContent = p.title || 'Imóvel';
    const addr = [p.address, p.houseNumber ? `Nº ${p.houseNumber}` : '', p.neighborhood, p.city, p.state].filter(Boolean).join(', ');
    $('address').innerHTML = `<i class="fa-solid fa-location-dot neon mr-2"></i>${esc(addr || 'Endereço não informado')}`;
    $('location-summary').textContent = addr || 'Endereço não informado';
    $('published').textContent = p.publishedAt ? `Publicado ${p.publishedAt}` : '';
    $('code-pill').textContent = p.code ? `Código ${p.code}` : '';
    $('price-label').textContent = p.priceLabel || (p.type === 'venda' ? 'valor de venda' : p.type === 'lazer' ? 'por diária' : 'por mês');
    $('price').textContent = p.price || 'Valor não informado'; $('lot').textContent = p.meters || 'Não informado'; $('code').textContent = p.code || '—';
    const rooms = p.rooms || {};
    const roomItems = [['fa-ruler-combined','Lote',p.meters],['fa-bed','Quartos',rooms.quartos],['fa-couch','Salas',rooms.salas],['fa-bath','Banheiros',rooms.banheiros],['fa-utensils','Cozinhas',rooms.cozinhas]];
    $('facts').innerHTML = roomItems.filter(([,label,value]) => label==='Lote' ? Boolean(value) : value !== undefined && value !== null && value !== '').map(([icon,label,value]) => `<span class="fact"><i class="fa-solid ${icon} neon mr-2"></i>${esc(value)} ${label==='Lote'?'':esc(label)}</span>`).join('') || '<span class="muted text-sm">Informações adicionais não informadas.</span>';
    $('solar').innerHTML = `<i class="fa-solid fa-sun text-yellow-400 mr-2"></i>${esc(rooms.sol || 'Posição solar não informada')}`;
    const description = p.description || p.details || '';
    if (description.trim()) { $('description-wrap').classList.remove('hidden'); $('description').textContent = description; }
    const amenities = Array.isArray(p.amenities) ? p.amenities : Array.isArray(p.comodidades) ? p.comodidades : [];
    if (p.type === 'lazer' && amenities.length) { $('amenities-wrap').classList.remove('hidden'); $('amenities').innerHTML = amenities.map(a => `<div class="amenity"><i class="fa-solid fa-check"></i><span>${esc(typeof a === 'string' ? a : a.label || a.name || '')}</span></div>`).join(''); }
    photos = (Array.isArray(p.photos) ? p.photos : []).filter(Boolean);
    if (!photos.length && p.photo) photos = [p.photo];
    if (!photos.length) photos = [''];
    paintGallery();
    $('owner-name').textContent = p.ownerName || 'Proprietário'; $('owner-phone').textContent = p.ownerPhone || '';
    $('owner-photo').src = p.ownerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
    const phone = String(p.ownerPhone || '').replace(/\D/g,''); const waPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const message = encodeURIComponent(`Olá, vi o anúncio no OpenWord: "${p.title || 'Imóvel'}" (${p.price || 'valor não informado'}). Ainda está disponível?`);
    $('contact').href = `https://wa.me/${waPhone}?text=${message}`;
    const mapQuery = [p.address, p.houseNumber, p.neighborhood, p.city, p.state, p.cep, p.reference].filter(Boolean).join(', ');
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery || addr || p.title || '')}`;
    $('route').href = mapUrl; $('route-inline').href = mapUrl;
    $('loading').classList.add('hidden'); $('property-page').classList.remove('hidden'); document.title = `${p.title || 'Imóvel'} | OpenWord`;
  } catch (error) { console.error('Erro ao carregar anúncio:', error); showError('Ocorreu um erro ao carregar o anúncio. Verifique sua conexão e tente novamente.'); }
})();
