const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let photos = [];
let photoIndex = 0;
function showError(message) { $('loading').classList.add('hidden'); $('property-page').classList.add('hidden'); $('error').classList.remove('hidden'); $('error-message').textContent = message; }
function paintPhoto() {
  if (!photos.length) return;
  $('main-photo').src = photos[photoIndex];
  $('photo-count').textContent = `Foto ${photoIndex + 1} de ${photos.length}`;
  $('prev-photo').classList.toggle('hidden', photos.length < 2);
  $('next-photo').classList.toggle('hidden', photos.length < 2);
  document.querySelectorAll('.thumb').forEach((el, i) => el.classList.toggle('active', i === photoIndex));
}
function changePhoto(step) { if (!photos.length) return; photoIndex = (photoIndex + step + photos.length) % photos.length; paintPhoto(); }
$('prev-photo').addEventListener('click', () => changePhoto(-1));
$('next-photo').addEventListener('click', () => changePhoto(1));
document.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') changePhoto(-1); if (e.key === 'ArrowRight') changePhoto(1); });
(async function init() {
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { showError('O link não contém o código do imóvel.'); return; }
    await window.firebaseBridgeReady;
    const bridge = window.firebaseBridge;
    const all = await bridge.loadProperties();
    const p = all.find(item => item.id === id);
    if (!p) { showError('Este anúncio não foi encontrado. Ele pode ter sido removido.'); return; }
    const cfg = { venda:{label:'VENDA',color:'#00e6a8'}, aluguel:{label:'ALUGUEL',color:'#38bdf8'}, lazer:{label:'ÁREA DE LAZER',color:'#eab308'} }[p.type] || {label:p.typeLabel || 'IMÓVEL',color:'#00e6a8'};
    $('type-badge').textContent = p.typeLabel || cfg.label; $('type-badge').style.color = '#041018'; $('type-badge').style.background = cfg.color;
    $('title').textContent = p.title || 'Imóvel';
    const addr = [p.address, p.houseNumber ? `Nº ${p.houseNumber}` : '', p.neighborhood, p.city, p.state].filter(Boolean).join(', ');
    $('address').innerHTML = `<i class="fa-solid fa-location-dot neon mr-2"></i>${esc(addr || 'Endereço não informado')}`;
    $('price-label').textContent = p.priceLabel || (p.type === 'venda' ? 'Valor de venda' : p.type === 'lazer' ? 'Valor da diária' : 'Valor mensal');
    $('price').textContent = p.price || 'Valor não informado'; $('lot').textContent = p.meters || 'Não informado';
    const rooms = p.rooms || {};
    $('rooms').innerHTML = [ ['fa-bed','Quartos',rooms.quartos],['fa-couch','Salas',rooms.salas],['fa-bath','Banheiros',rooms.banheiros],['fa-utensils','Cozinhas',rooms.cozinhas] ].map(([icon,label,value]) => `<div class="spec text-sm"><i class="fa-solid ${icon} neon mr-2"></i>${esc(value ?? '—')} ${label}</div>`).join('');
    $('solar').innerHTML = `<i class="fa-solid fa-sun text-yellow-400 mr-2"></i>${esc(rooms.sol || 'Posição solar não informada')}`;
    const description = p.description || p.details || '';
    if (description.trim()) { $('description-wrap').classList.remove('hidden'); $('description').textContent = description; }
    const amenities = Array.isArray(p.amenities) ? p.amenities : Array.isArray(p.comodidades) ? p.comodidades : [];
    if (p.type === 'lazer' && amenities.length) { $('amenities-wrap').classList.remove('hidden'); $('amenities').innerHTML = amenities.map(a => `<div><i class="fa-solid fa-check text-yellow-400 mr-2"></i>${esc(typeof a === 'string' ? a : a.label || a.name || '')}</div>`).join(''); }
    photos = (Array.isArray(p.photos) ? p.photos : []).filter(Boolean);
    if (!photos.length) photos = [''];
    $('thumbnails').innerHTML = photos.length > 1 ? photos.map((src,i) => `<img class="thumb ${i===0?'active':''}" src="${esc(src)}" alt="Foto ${i+1}" data-index="${i}">`).join('') : '';
    $('thumbnails').querySelectorAll('.thumb').forEach(el => el.addEventListener('click', () => { photoIndex = Number(el.dataset.index); paintPhoto(); }));
    paintPhoto();
    $('published').textContent = p.publishedAt ? `Publicado ${p.publishedAt}` : 'OpenWord'; $('code').textContent = p.code || '';
    $('owner-name').textContent = p.ownerName || 'Proprietário'; $('owner-phone').textContent = p.ownerPhone || '';
    $('owner-photo').src = p.ownerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
    const phone = String(p.ownerPhone || '').replace(/\D/g,''); const waPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const message = encodeURIComponent(`Olá, vi o anúncio no OpenWord: "${p.title || 'Imóvel'}" (${p.price || 'valor não informado'}). Ainda está disponível?`);
    $('contact').href = `https://wa.me/${waPhone}?text=${message}`;
    const mapQuery = [p.address, p.houseNumber, p.neighborhood, p.city, p.state, p.cep, p.reference].filter(Boolean).join(', ');
    $('route').href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery || addr || p.title || '')}`;
    $('loading').classList.add('hidden'); $('property-page').classList.remove('hidden'); document.title = `${p.title || 'Imóvel'} | OpenWord`;
  } catch (error) { console.error('Erro ao carregar anúncio:', error); showError('Ocorreu um erro ao carregar o anúncio. Verifique sua conexão e tente novamente.'); }
})();
