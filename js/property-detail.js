const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let photos = [];
let photoIndex = 0;
let property = null;
let signedInUser = null;
let propertyReviews = [];
let selectedStars = 0;
let reviewSaving = false;
function showError(message) { $('loading').classList.add('hidden'); $('property-page').classList.add('hidden'); $('error').classList.remove('hidden'); $('error-message').textContent = message; }
function paintAccountState(user) { const label = $('detail-account-label'); const link = $('detail-account-link'); if (!label || !link) return; if (user) { label.textContent = (user.displayName || user.email?.split('@')[0] || 'Minha conta').split(' ')[0]; link.setAttribute('aria-label', `Minha conta: ${user.displayName || user.email || 'usuário conectado'}`); } else { label.textContent = 'Minha conta'; link.setAttribute('aria-label', 'Entrar na minha conta OpenWord'); } }

function reviewDate(review) {
  const value = review.createdAt || review.updatedAt;
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : 'Visitante OpenWord';
}
function paintReviewStars() {
  document.querySelectorAll('[data-star]').forEach(button => {
    const active = Number(button.dataset.star) <= selectedStars;
    button.classList.toggle('active', active);
    button.setAttribute('aria-checked', String(Number(button.dataset.star) === selectedStars));
  });
}
function paintReviewSummary() {
  const count = propertyReviews.length;
  const average = count ? propertyReviews.reduce((sum, review) => sum + Number(review.stars || 0), 0) / count : 0;
  if ($('guest-badge')) {
    $('guest-badge').classList.toggle('hidden', property?.type !== 'lazer');
    $('guest-average').textContent = count ? average.toFixed(1).replace('.', ',') : '—';
    $('guest-count').textContent = String(count);
    $('guest-stars').textContent = count ? '★'.repeat(Math.round(average)) + '☆'.repeat(5 - Math.round(average)) : '☆☆☆☆☆';
    $('guest-badge-title').textContent = count >= 5 && average >= 4.8 ? 'Preferido dos hóspedes' : 'Avaliações dos visitantes';
    $('guest-badge-copy').textContent = count ? (count >= 5 && average >= 4.8 ? 'Um dos espaços mais bem avaliados pelos visitantes' : 'Nota média baseada nas avaliações deste espaço') : 'Seja a primeira pessoa a avaliar este espaço';
  }
}
function paintReviews() {
  const list = $('review-list');
  if (!list) return;
  const ordered = [...propertyReviews].sort((a,b) => {
    const time = item => (item.createdAt?.toMillis ? item.createdAt.toMillis() : item.updatedAt?.toMillis ? item.updatedAt.toMillis() : 0);
    return time(b) - time(a);
  });
  list.innerHTML = ordered.length ? ordered.map(review => `<article class="review-item"><div class="review-item-top"><div><div class="review-author">${esc(review.authorName || 'Visitante OpenWord')}</div><div class="guest-stars" aria-label="Nota ${Number(review.stars)||0} de 5">${'★'.repeat(Math.max(0,Math.min(5,Number(review.stars)||0)))}${'☆'.repeat(5-Math.max(0,Math.min(5,Number(review.stars)||0)))}</div></div><time class="review-date">${esc(reviewDate(review))}</time></div><p class="review-text">${esc(review.text || '')}</p>${signedInUser?.uid === review.authorId ? '<p class="review-note">Esta é sua avaliação. Se publicar novamente, ela será atualizada.</p>' : ''}</article>`).join('') : '<p class="muted text-sm">Ainda não há avaliações. Sua experiência pode ajudar outras pessoas.</p>';
  paintReviewSummary();
}
function paintReviewForm() {
  const fields = $('review-form-fields');
  const note = $('review-auth-note');
  if (!fields || !note) return;
  if (property?.ownerId && signedInUser?.uid === property.ownerId) {
    fields.classList.add('hidden');
    note.textContent = 'O anunciante não pode avaliar o próprio anúncio.';
    return;
  }
  if (!signedInUser) {
    fields.classList.add('hidden');
    note.innerHTML = 'Para avaliar, <a href="./?openAccount=1" class="neon underline font-extrabold">entre na sua conta OpenWord</a>. Depois de entrar, volte a esta página; a sessão será reconhecida automaticamente.';
    return;
  }
  fields.classList.remove('hidden');
  const own = propertyReviews.find(review => review.authorId === signedInUser.uid);
  if (own) {
    selectedStars = Number(own.stars) || 0;
    $('review-comment').value = own.text || '';
    $('review-submit').textContent = 'Atualizar avaliação';
    note.textContent = 'Você já avaliou este anúncio. Se publicar novamente, sua avaliação será atualizada.';
  } else {
    $('review-submit').textContent = 'Publicar avaliação';
    note.textContent = `Conectado como ${signedInUser.displayName || signedInUser.email || 'usuário OpenWord'}.`;
  }
  paintReviewStars();
}
async function submitPropertyReview() {
  if (reviewSaving) return;
  if (!signedInUser) { $('review-auth-note').innerHTML = 'Para avaliar, <a href="./?openAccount=1" class="neon underline font-extrabold">entre na sua conta OpenWord</a> e volte a esta página.'; return; }
  if (property?.ownerId && signedInUser.uid === property.ownerId) { $('review-auth-note').textContent = 'O anunciante não pode avaliar o próprio anúncio.'; return; }
  const text = $('review-comment').value.trim();
  if (!selectedStars) { $('review-status').textContent = 'Escolha uma nota de 1 a 5 estrelas.'; return; }
  if (!text) { $('review-status').textContent = 'Escreva um comentário antes de publicar.'; return; }
  reviewSaving = true;
  $('review-submit').disabled = true;
  $('review-submit').textContent = 'Publicando...';
  $('review-status').textContent = '';
  try {
    await window.firebaseBridge.savePropertyReview({ propertyId: property.id, stars: selectedStars, text });
    propertyReviews = await window.firebaseBridge.loadPropertyReviews(property.id);
    paintReviews();
    paintReviewForm();
    $('review-status').textContent = 'Sua avaliação foi salva.';
  } catch (error) {
    console.error('Falha ao salvar avaliação do imóvel:', error);
    $('review-status').textContent = window.firebaseBridge?.friendlyError(error) || error.message || 'Não foi possível salvar. Tente novamente.';
  } finally {
    reviewSaving = false;
    $('review-submit').disabled = false;
    if (signedInUser && !propertyReviews.find(review => review.authorId === signedInUser.uid)) $('review-submit').textContent = 'Publicar avaliação';
    else $('review-submit').textContent = 'Atualizar avaliação';
  }
}
document.querySelectorAll('[data-star]').forEach(button => button.addEventListener('click', () => { selectedStars = Number(button.dataset.star); paintReviewStars(); }));
$('review-submit')?.addEventListener('click', submitPropertyReview);

function amenityLabel(item) { return String(typeof item === 'string' ? item : item?.label || item?.name || item?.title || '').trim(); }
function amenityIcon(label) {
  const value = String(label || '').toLocaleLowerCase('pt-BR');
  const rules = [
    [/wi.?fi|internet|wifi/, 'fa-wifi'], [/piscina|borda infinita/, 'fa-person-swimming'], [/praia|mar|beira.mar/, 'fa-water'], [/cozinha|fogão|forno|micro.ondas|geladeira|utensílio/, 'fa-utensils'], [/estacionamento|garagem|vaga/, 'fa-car'], [/tv|televisão|televisor/, 'fa-tv'], [/lavar|lavadora|máquina de lavar|secadora/, 'fa-soap'], [/elevador/, 'fa-building'], [/ar condicionado|climatiza/, 'fa-snowflake'], [/churrasqueira|churrasco/, 'fa-fire-burner'], [/academia|fitness/, 'fa-dumbbell'], [/jardim|área verde/, 'fa-tree'], [/varanda|sacada|terraço/, 'fa-umbrella'], [/trabalho|escritório|mesa/, 'fa-laptop'], [/segurança|portaria|porteiro/, 'fa-shield-halved'], [/câmera|monitoramento/, 'fa-video'], [/banheira|hidromassagem/, 'fa-bath'], [/pet|animal/, 'fa-paw'], [/acessibilidade|cadeirante/, 'fa-wheelchair'], [/cama|roupa de cama|lençol/, 'fa-bed'], [/vista/, 'fa-image'], [/água|chuveiro|banheiro/, 'fa-shower'], [/energia|gerador/, 'fa-bolt'], [/portão/, 'fa-door-closed'], [/salão|festa|evento/, 'fa-champagne-glasses'], [/mesa|jantar/, 'fa-chair']
  ];
  return (rules.find(([pattern]) => pattern.test(value)) || [null, 'fa-circle-check'])[1];
}
function amenityMarkup(label) { return `<div class="amenity"><i class="fa-solid ${amenityIcon(label)}" aria-hidden="true"></i><span>${esc(label)}</span></div>`; }
function openAmenityModal() { $('amenity-modal').classList.add('open'); document.body.style.overflow='hidden'; $('amenity-modal-close').focus(); }
function closeAmenityModal() { $('amenity-modal').classList.remove('open'); document.body.style.overflow = $('photo-modal').classList.contains('open') ? 'hidden' : ''; }
$('show-all-amenities')?.addEventListener('click', openAmenityModal);
$('amenity-modal-close')?.addEventListener('click', closeAmenityModal);
$('amenity-modal')?.addEventListener('click', event => { if (event.target === $('amenity-modal')) closeAmenityModal(); });


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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('photo-modal').classList.contains('open')) closeGallery(); if ($('amenity-modal').classList.contains('open')) closeAmenityModal(); return; }
  if (!$('photo-modal').classList.contains('open')) return;
  if (e.key === 'ArrowLeft') changePhoto(-1); if (e.key === 'ArrowRight') changePhoto(1);
});
(async function init() {
  try {
    const params = new URLSearchParams(location.search);
    const id = params.get('id') || params.get('imovel') || params.get('propertyId');
    if (!id) { showError('O link deste anúncio está incompleto: não encontramos o código do imóvel. Volte à lista e abra o anúncio novamente.'); return; }

    // Carrega o anúncio primeiro, sem depender da restauração da sessão de login.
    // A lista pública já é usada pela vitrine principal e mantém compatibilidade com anúncios existentes.
    await window.firebaseBridgeReady;
    const bridge = window.firebaseBridge;
    if (!bridge) throw new Error('A conexão com o Firebase não foi inicializada.');

    // A sessão e os controles de avaliação são inicializados em paralelo com o anúncio.
    // Se a sessão demorar ou falhar, a página do imóvel ainda poderá ser exibida.
    try {
      bridge.startAuthListener(user => {
        signedInUser = user || null;
        paintAccountState(signedInUser);
        paintReviewForm();
        paintReviews();
      });
      signedInUser = await Promise.race([
        bridge.waitForAuthReady(),
        new Promise(resolve => setTimeout(() => resolve(bridge.getCurrentUser?.() || null), 3500))
      ]);
      paintAccountState(signedInUser);
    } catch (authError) {
      console.warn('Não foi possível restaurar a sessão nesta aba; o anúncio será carregado mesmo assim.', authError);
      signedInUser = bridge.getCurrentUser?.() || null;
      paintAccountState(signedInUser);
    }

    // Primeiro tenta o documento direto; se isso falhar ou não o encontrar, usa a mesma
    // leitura da coleção que alimenta a vitrine principal (compatibilidade com dados antigos).
    try { property = await bridge.getProperty(id); }
    catch (directReadError) { console.warn('Leitura direta do anúncio falhou; tentando a lista pública.', directReadError); }
    if (!property) {
      const allProperties = await bridge.loadProperties();
      property = allProperties.find(item => String(item.id) === String(id)) || null;
    }
    if (!property) {
      showError('Não encontramos este anúncio. Volte à lista de imóveis e abra o anúncio novamente. Se o problema continuar, atualize a página inicial e tente de novo.');
      return;
    }
    const p = property;
    // Avaliações são exclusivas de anúncios do tipo área de lazer.
    // Venda e aluguel não devem exibir nem carregar o formulário de avaliação.
    const reviewsSection = $('reviews-section');
    const isLeisureProperty = String(p.type || '').trim().toLocaleLowerCase('pt-BR') === 'lazer';
    if (reviewsSection) reviewsSection.classList.toggle('hidden', !isLeisureProperty);
    const cfg = { venda:{label:'VENDA',color:'#00e6a8'}, aluguel:{label:'ALUGUEL',color:'#38bdf8'}, lazer:{label:'ÁREA DE LAZER',color:'#eab308'} }[p.type] || {label:p.typeLabel || 'IMÓVEL',color:'#00e6a8'};
    $('type-badge').innerHTML = `<i class="fa-solid fa-house"></i>${esc(p.typeLabel || cfg.label)}`; $('type-badge').style.color = cfg.color; $('type-badge').style.borderColor = cfg.color;
    $('title').textContent = p.title || 'Imóvel';
    const addr = [p.address, p.houseNumber ? `Nº ${p.houseNumber}` : '', p.neighborhood, p.city, p.state].filter(Boolean).join(', ');
    $('address').innerHTML = `<i class="fa-solid fa-location-dot neon mr-2"></i>${esc(addr || 'Endereço não informado')}`;
    $('location-summary').textContent = addr || 'Endereço não informado';
    $('published').textContent = p.publishedAt ? `Publicado ${typeof p.publishedAt === 'string' ? p.publishedAt : ''}` : '';
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
    if (p.type === 'lazer') {
      $('amenities-wrap').classList.remove('hidden'); $('guest-badge').classList.remove('hidden');
      const labels = [...new Set(amenities.map(amenityLabel).filter(Boolean))];
      const visibleCount = 8;
      $('amenities').innerHTML = labels.length ? labels.slice(0, visibleCount).map(amenityMarkup).join('') : '<p class="muted text-sm">O anunciante ainda não cadastrou itens de lazer.</p>';
      $('amenity-modal-list').innerHTML = labels.map(amenityMarkup).join('');
      $('show-all-amenities').classList.toggle('hidden', labels.length <= visibleCount);
      $('show-all-amenities-label').textContent = `Mostrar todas as ${labels.length} comodidades`;
      $('amenity-modal-title').textContent = `Todas as ${labels.length} comodidades`;
    }
    photos = (Array.isArray(p.photos) ? p.photos : []).filter(Boolean);
    if (!photos.length && p.photo) photos = [p.photo];
    if (!photos.length) photos = [''];
    paintGallery();

    // As avaliações só existem para áreas de lazer. A leitura é omitida em venda/aluguel.
    if (isLeisureProperty) {
      // Falha ao ler avaliações não pode derrubar a página do anúncio inteiro.
      try {
        propertyReviews = await bridge.loadPropertyReviews(p.id);
      } catch (reviewError) {
        console.error('Não foi possível carregar avaliações. Verifique as regras do Firestore para propertyReviews:', reviewError);
        propertyReviews = [];
        const systemStatus = $('review-system-status');
        if (systemStatus) { systemStatus.textContent = 'As avaliações estão temporariamente indisponíveis. Publique as regras do Firestore incluídas no pacote para ativá-las.'; systemStatus.classList.remove('hidden'); }
      }
      paintReviews();
      paintReviewForm();
    } else {
      propertyReviews = [];
      if ($('guest-badge')) $('guest-badge').classList.add('hidden');
    }
    $('owner-name').textContent = p.ownerName || 'Proprietário'; $('owner-phone').textContent = p.ownerPhone || '';
    $('owner-photo').src = p.ownerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
    const phone = String(p.ownerPhone || '').replace(/\D/g,''); const waPhone = phone ? (phone.startsWith('55') ? phone : `55${phone}`) : '';
    const message = encodeURIComponent(`Olá, vi o anúncio no OpenWord: "${p.title || 'Imóvel'}" (${p.price || 'valor não informado'}). Ainda está disponível?`);
    $('contact').href = waPhone ? `https://wa.me/${waPhone}?text=${message}` : '#';
    $('contact').setAttribute('aria-disabled', String(!waPhone));
    if (!waPhone) $('contact').addEventListener('click', event => { event.preventDefault(); $('owner-phone').textContent = 'O anunciante ainda não cadastrou um WhatsApp válido.'; });
    const mapQuery = [p.address, p.houseNumber, p.neighborhood, p.city, p.state, p.cep, p.reference].filter(Boolean).join(', ');
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery || addr || p.title || '')}`;
    $('route').href = mapUrl; $('route-inline').href = mapUrl;
    $('loading').classList.add('hidden'); $('property-page').classList.remove('hidden'); document.title = `${p.title || 'Imóvel'} | OpenWord`;
  } catch (error) {
    console.error('Erro ao carregar anúncio:', error);
    const bridge = window.firebaseBridge;
    const detail = bridge?.friendlyError ? bridge.friendlyError(error) : (error?.message || 'Erro desconhecido');
    showError(`Não foi possível carregar este anúncio. ${detail} Confira a conexão e se as regras do Firestore permitem leitura pública dos anúncios.`);
  }
})();
