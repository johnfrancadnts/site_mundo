// User Authentication State: STARTS 100% LOGGED OUT
  let currentUser = {
    isLoggedIn: false,
    name: '',
    email: '',
    phone: '',
    avatar: '',
    memberSince: 'Janeiro de 2025',
    rating: 5.0,
    reviews: []
  };

  // Property dataset starts clean (NO FAKE / PRESET PROPERTIES)
  let propertyList = [];
  let currentFeatured = null;
  let featuredPhotoIndex = 0;
  let activeFilter = 'todos';
  let uploadedPhotos = [];

  // Owners profile store for reviews & stats
  let ownersDatabase = {};

  const typeConfig = {
    venda: { color: '#00e6a8', bg: 'rgba(0, 230, 168, 0.15)', border: '#00e6a8', text: '#00e6a8', label: 'Venda' },
    aluguel: { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#38bdf8', label: 'Aluguel' },
    lazer: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#eab308', label: 'Área de Lazer' }
  };

  // Navigation View Switcher (Main Vitrine vs Dedicated Profile)
  function showMainView(targetHash = '') {
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('view-profile').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (targetHash) {
      setTimeout(() => {
        const el = document.querySelector(targetHash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }

  function showOwnerProfile(ownerObj) {
    if (!ownerObj || !ownerObj.name) {
      showToast('Perfil', 'Proprietário ainda não possui perfil disponível.', 'fa-user');
      return;
    }

    const key = ownerObj.uid || ownerObj.phone || ownerObj.name;
    if (!ownersDatabase[key]) {
      ownersDatabase[key] = { name: ownerObj.name, phone: ownerObj.phone || '', avatar: ownerObj.avatar || '', uid: ownerObj.uid || '', memberSince: ownerObj.memberSince || '', reviews: [] };
    } else {
      ownersDatabase[key] = { ...ownersDatabase[key], ...ownerObj, reviews: ownersDatabase[key].reviews || [] };
    }

    const owner = ownersDatabase[key];
    currentViewedOwner = owner;

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-profile').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Preenche cabeçalho do perfil
    document.getElementById('owner-page-name').textContent = owner.name;
    document.getElementById('owner-page-member-since').textContent = owner.memberSince;
    document.getElementById('owner-page-avatar').src = owner.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
    
    let cleanPhone = owner.phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    const whatsMsg = encodeURIComponent(`Olá ${owner.name}, vi seu perfil no OpenWord e gostaria de informações sobre seus imóveis.`);
    document.getElementById('owner-page-whatsapp').href = `https://wa.me/${cleanPhone}?text=${whatsMsg}`;

    // Calcula Score de estrelas
    renderOwnerReviewsAndScore(owner);

    // Lista imóveis do proprietário
    const ownerListings = propertyList.filter(p => (owner.uid && p.ownerId === owner.uid) || p.ownerName === owner.name || p.ownerPhone === owner.phone);
    document.getElementById('owner-page-listings-count').textContent = ownerListings.length;
    
    const grid = document.getElementById('owner-page-listings-grid');
    grid.innerHTML = '';

    if (ownerListings.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-8 text-center bg-cardnavy/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
          Nenhum anúncio publicado atualmente por este proprietário.
        </div>
      `;
    } else {
      ownerListings.forEach(prop => {
        const cfg = typeConfig[prop.type] || typeConfig.aluguel;
        const item = document.createElement('div');
        item.className = 'bg-cardnavy border border-cyan-900/40 rounded-2xl p-3 flex flex-col justify-between hover:border-neon/60 transition';
        item.innerHTML = `
          <div class="relative w-full h-36 rounded-xl overflow-hidden bg-black/60 mb-2.5">
            <img src="${prop.photos[0]}" class="w-full h-full object-cover">
            <span class="absolute top-2 left-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style="background:${cfg.bg}; color:${cfg.color}; border: 1px solid ${cfg.border}">
              ${prop.typeLabel}
            </span>
          </div>
          <div>
            <h4 class="font-bold text-white text-xs truncate">${prop.title}</h4>
            <p class="text-[11px] text-slate-400 truncate mt-0.5">${prop.address}</p>
            <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
              <span class="text-xs font-black" style="color:${cfg.color}">${prop.price}</span>
              <button onclick="showMainView('#destaque'); setAsFeatured('${prop.id}')" class="text-[10px] text-neon hover:underline font-bold">
                Ver Destaque <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        `;
        grid.appendChild(item);
      });
    }
  }

  function viewCurrentFeaturedOwnerProfile() {
    if (!currentFeatured) return;
    showOwnerProfile({
      uid: currentFeatured.ownerId || '',
      name: currentFeatured.ownerName,
      phone: currentFeatured.ownerPhone,
      avatar: currentFeatured.ownerPhoto
    });
  }

  // Toast Functionality
  function showToast(title, message, icon = 'fa-bell') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    document.getElementById('toast-icon').innerHTML = `<i class="fa-solid ${icon}"></i>`;
    toast.classList.remove('translate-x-[120%]');
    setTimeout(() => {
      toast.classList.add('translate-x-[120%]');
    }, 4000);
  }

  // Auth UI Rendering
  function updateAuthUI() {
    const defaultIcon = document.getElementById('account-default-icon');
    const headerImg = document.getElementById('account-header-img');
    const btnLabel = document.getElementById('account-btn-label');
    const chevron = document.getElementById('account-chevron');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserEmail = document.getElementById('dropdown-user-email');

    if (currentUser.isLoggedIn) {
      if (currentUser.avatar) {
        headerImg.src = currentUser.avatar;
        headerImg.classList.remove('hidden');
        defaultIcon.classList.add('hidden');
      } else {
        const initials = currentUser.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
        defaultIcon.className = 'text-[11px] font-bold text-neon';
        defaultIcon.textContent = initials || 'US';
        defaultIcon.classList.remove('hidden');
        headerImg.classList.add('hidden');
      }
      btnLabel.textContent = currentUser.name.split(' ')[0].toUpperCase();
      chevron.classList.remove('hidden');
      dropdownUserName.textContent = currentUser.name;
      dropdownUserEmail.textContent = currentUser.email || 'Conta OpenWord';
    } else {
      headerImg.classList.add('hidden');
      defaultIcon.className = 'fa-regular fa-user';
      defaultIcon.textContent = '';
      defaultIcon.classList.remove('hidden');
      btnLabel.textContent = 'CONTA';
      chevron.classList.add('hidden');
      document.getElementById('account-dropdown').classList.add('hidden');
    }
  }

  function handleAccountButtonClick() {
    if (currentUser.isLoggedIn) {
      toggleDropdown();
    } else {
      openAuthModal(false);
    }
  }

  function toggleDropdown() {
    const dd = document.getElementById('account-dropdown');
    dd.classList.toggle('hidden');
  }

  document.addEventListener('click', (e) => {
    const accountBtn = document.getElementById('account-btn');
    const dropdown = document.getElementById('account-dropdown');
    if (accountBtn && dropdown && !accountBtn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Auth mode: signup or login
  let authMode = 'signup';

  function toggleAuthMode() {
    authMode = authMode === 'signup' ? 'login' : 'signup';
    const title = document.getElementById('auth-modal-title');
    const subtitle = document.getElementById('auth-modal-subtitle');
    const submit = document.querySelector('#auth-form button[type="submit"]');
    const toggle = document.getElementById('auth-mode-toggle');
    const footer = document.getElementById('auth-footer-note');
    const nameInput = document.getElementById('auth-name');
    const phoneInput = document.getElementById('auth-phone');
    const photoUrl = document.getElementById('auth-photo-url');
    const photoFile = document.getElementById('auth-photo-file');
    const nameSection = nameInput?.parentElement;
    const phoneSection = phoneInput?.parentElement;
    const photoSection = photoUrl?.parentElement?.parentElement?.parentElement;
    if (nameSection) nameSection.classList.toggle('hidden', authMode === 'login');
    if (phoneSection) phoneSection.classList.toggle('hidden', authMode === 'login');
    if (photoSection) photoSection.classList.toggle('hidden', authMode === 'login');
    if (nameInput) nameInput.required = authMode === 'signup';
    if (phoneInput) phoneInput.required = authMode === 'signup';
    if (title) title.textContent = authMode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta';
    if (subtitle) subtitle.textContent = authMode === 'login' ? 'Acesse sua conta OpenWord para continuar' : 'Cadastre-se para publicar e gerenciar seus imóveis';
    if (submit) submit.innerHTML = authMode === 'login' ? '<i class="fa-solid fa-right-to-bracket"></i> ENTRAR' : '<i class="fa-solid fa-user-plus"></i> CRIAR CONTA';
    if (toggle) toggle.textContent = authMode === 'login' ? 'Ainda não tem conta? Criar conta' : 'Já tem uma conta? Entrar';
    if (footer) footer.textContent = authMode === 'login' ? 'Use o e-mail e a senha cadastrados. Se confirmou o e-mail, poderá entrar.' : 'A confirmação de e-mail é necessária para acessar com e-mail e senha.';
    const verifyPanel = document.getElementById('email-verification-panel');
    if (verifyPanel) verifyPanel.classList.add('hidden');
  }

  // Auth Gate
  function handleAnnounceClick() {
    if (!currentUser.isLoggedIn) {
      showToast('Acesso Restrito', 'Faça login ou crie sua conta para anunciar seu imóvel!', 'fa-lock');
      openAuthModal(true);
      return;
    }
    openModal();
  }

  function openAuthModal(gateTriggered = false) {
    if (authMode !== 'signup' && document.getElementById('email-verification-panel')?.classList.contains('hidden')) toggleAuthMode();
    const modal = document.getElementById('auth-modal');
    const notice = document.getElementById('auth-gate-notice');
    if (gateTriggered) {
      notice.classList.remove('hidden');
    } else {
      notice.classList.add('hidden');
    }
    modal.classList.remove('hidden');
  }

  function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
  }

  function previewAuthAvatar(url) {
    const preview = document.getElementById('auth-avatar-preview');
    const placeholder = document.getElementById('auth-avatar-placeholder');
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image'))) {
      preview.src = url;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }
  }

  async function compressImageFile(file, maxBytes = 95000, maxWidth = 1200) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl;
    });
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.78;
    let compressed = canvas.toDataURL('image/jpeg', quality);
    while (compressed.length > maxBytes && quality > 0.35) {
      quality -= 0.08;
      compressed = canvas.toDataURL('image/jpeg', quality);
    }
    if (compressed.length > maxBytes) {
      const scaleAgain = 0.72;
      canvas.width = Math.max(1, Math.round(canvas.width * scaleAgain));
      canvas.height = Math.max(1, Math.round(canvas.height * scaleAgain));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      compressed = canvas.toDataURL('image/jpeg', 0.42);
    }
    if (compressed.length > maxBytes) throw new Error('A imagem é muito grande para o limite de armazenamento gratuito.');
    return compressed;
  }

  async function previewAuthAvatarFile(input) {
    if (!input.files || !input.files[0]) return;
    try {
      const compressed = await compressImageFile(input.files[0], 65000, 400);
      const preview = document.getElementById('auth-avatar-preview');
      const placeholder = document.getElementById('auth-avatar-placeholder');
      preview.src = compressed;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    } catch (err) { showToast('Foto não carregada', err.message || 'Escolha outra imagem.', 'fa-image'); }
  }

  function showEmailVerificationPanel(email, message) {
    const panel = document.getElementById('email-verification-panel');
    const address = document.getElementById('email-verification-address');
    const messageEl = document.getElementById('email-verification-message');
    if (address) address.textContent = email || '';
    if (messageEl && message) messageEl.textContent = message;
    if (panel) panel.classList.remove('hidden');
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function getVerificationFormData() {
    const preview = document.getElementById('auth-avatar-preview');
    const previewSrc = preview && !preview.classList.contains('hidden') ? preview.src : '';
    const avatarUrl = document.getElementById('auth-photo-url').value.trim();
    return {
      name: document.getElementById('auth-name').value.trim(),
      email: document.getElementById('auth-email').value.trim(),
      password: document.getElementById('auth-password').value,
      phone: document.getElementById('auth-phone').value.trim(),
      avatar: avatarUrl || (previewSrc.startsWith('http') || previewSrc.startsWith('data:image/jpeg') ? previewSrc : '')
    };
  }

  async function checkEmailVerification() {
    const data = getVerificationFormData();
    if (!data.email || !data.password) {
      showToast('Informe seus dados', 'Preencha o e-mail e a senha usados no cadastro antes de verificar.', 'fa-envelope');
      return;
    }
    try {
      const result = await window.firebaseBridge.checkEmailVerification(data);
      if (!result.verified) {
        showEmailVerificationPanel(data.email, 'Ainda não identificamos a confirmação. Abra o link mais recente enviado ao seu e-mail e depois tente novamente.');
        showToast('Ainda não confirmado', 'Abra o link no Gmail e volte para verificar novamente.', 'fa-envelope');
        return;
      }
      const profile = result.profile || {};
      currentUser = { isLoggedIn: true, uid: result.user.uid, name: profile.name || result.user.displayName || data.name || data.email.split('@')[0], email: result.user.email || data.email, phone: profile.phone || data.phone || '', avatar: profile.avatar || result.user.photoURL || data.avatar || '', memberSince: profile.memberSince || new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()) };
      document.getElementById('email-verification-panel')?.classList.add('hidden');
      updateAuthUI();
      closeAuthModal();
      await loadFirebaseContent();
      showToast('E-mail confirmado!', `Conta confirmada. Bem-vindo(a), ${currentUser.name.split(' ')[0]}!`, 'fa-circle-check');
    } catch (err) {
      console.error('Erro verificando confirmação de e-mail:', err);
      showToast('Não foi possível verificar', window.firebaseBridge?.friendlyError(err) || err.message, 'fa-triangle-exclamation');
    }
  }

  async function resendEmailVerification() {
    const data = getVerificationFormData();
    if (!data.email || !data.password) {
      showToast('Informe seus dados', 'Preencha o e-mail e a senha usados no cadastro para reenviar o link.', 'fa-envelope');
      return;
    }
    try {
      const result = await window.firebaseBridge.resendVerification(data);
      if (result.alreadyVerified) {
        await checkEmailVerification();
        return;
      }
      showEmailVerificationPanel(data.email, 'Enviamos outro link de confirmação. Confira a caixa de entrada e o spam; depois volte e clique em “Já confirmei — verificar”.');
      showToast('Link reenviado', 'Confira seu Gmail e também a pasta de spam.', 'fa-envelope-circle-check');
    } catch (err) {
      console.error('Erro reenviando verificação:', err);
      showToast('Não foi possível reenviar', window.firebaseBridge?.friendlyError(err) || err.message, 'fa-triangle-exclamation');
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    const name = authMode === 'signup' ? document.getElementById('auth-name').value.trim() : '';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const phone = authMode === 'signup' ? document.getElementById('auth-phone').value.trim() : '';
    const avatarUrl = document.getElementById('auth-photo-url').value.trim();
    const preview = document.getElementById('auth-avatar-preview');
    const previewSrc = preview.classList.contains('hidden') ? '' : preview.src;
    const finalAvatar = avatarUrl || (previewSrc.startsWith('http') || previewSrc.startsWith('data:image/jpeg') ? previewSrc : '');
    if (!window.firebaseBridge) { showToast('Firebase indisponível', 'Aguarde carregar a conexão e tente novamente.', 'fa-triangle-exclamation'); return; }
    if (password.length < 6) { showToast('Senha inválida', 'A senha precisa ter pelo menos 6 caracteres.', 'fa-lock'); return; }
    if (authMode === 'signup' && !name) { showToast('Informe seu nome', 'Preencha seu nome completo para criar a conta.', 'fa-user'); return; }
    if (authMode === 'signup' && !phone) { showToast('Informe seu WhatsApp', 'Preencha seu WhatsApp para criar a conta.', 'fa-phone'); return; }
    try {
      const result = await window.firebaseBridge.emailPasswordFlow({ name, email, password, phone, avatar: finalAvatar });
      if (result.needsVerification) {
        showEmailVerificationPanel(email, 'Enviamos um link de confirmação. Abra o Gmail, clique no link e volte ao OpenWord. Depois clique em “Já confirmei — verificar”.');
        showToast('Confira seu Gmail', 'O painel de confirmação ficará aberto até você concluir ou verificar o e-mail.', 'fa-envelope');
        return;
      }
      if (result.user) {
        const profile = result.profile || {};
        currentUser = { isLoggedIn: true, uid: result.user.uid, name: profile.name || result.user.displayName || name || email.split('@')[0], email: result.user.email || email, phone: profile.phone || phone || '', avatar: profile.avatar || result.user.photoURL || finalAvatar || '', memberSince: profile.memberSince || new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()) };
        updateAuthUI();
        const shouldOpenAnnounce = !document.getElementById('auth-gate-notice').classList.contains('hidden');
        closeAuthModal();
        showToast('Sucesso', `Bem-vindo(a), ${currentUser.name.split(' ')[0]}!`, 'fa-circle-check');
        if (shouldOpenAnnounce) openModal();
      }
    } catch (err) { console.error('Erro na autenticação:', err); showToast('Não foi possível entrar', window.firebaseBridge.friendlyError(err), 'fa-triangle-exclamation'); }
  }

  async function loginWithGoogle() {
    try { if (!window.firebaseBridge) throw new Error('Firebase ainda está carregando.'); await window.firebaseBridge.googleLogin(); }
    catch (err) { console.error('Erro no login Google:', err); showToast('Login Google', window.firebaseBridge?.friendlyError(err) || err.message, 'fa-triangle-exclamation'); }
  }

  async function recoverPassword() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) { showToast('Informe seu e-mail', 'Digite seu e-mail no campo acima e clique novamente em “Esqueci minha senha”.', 'fa-envelope'); document.getElementById('auth-email').focus(); return; }
    try { await window.firebaseBridge.sendPasswordReset(email); showToast('E-mail enviado', 'Se a conta existir, você receberá um link para redefinir a senha.', 'fa-envelope-circle-check'); }
    catch (err) { showToast('Não foi possível enviar', window.firebaseBridge?.friendlyError(err) || 'Tente novamente mais tarde.', 'fa-triangle-exclamation'); }
  }

  async function applyFirebaseUser(user) {
    if (!user) { currentUser = { isLoggedIn: false, uid: '', name: '', email: '', phone: '', avatar: '', memberSince: '' }; updateAuthUI(); await loadFirebaseContent(); return; }
    try {
      const profile = await window.firebaseBridge.getUserProfile(user.uid) || {};
      currentUser = { isLoggedIn: true, uid: user.uid, name: profile.name || user.displayName || (user.email || '').split('@')[0] || 'Usuário', email: user.email || '', phone: profile.phone || '', avatar: profile.avatar || user.photoURL || '', memberSince: profile.memberSince || new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()) };
      updateAuthUI(); await loadFirebaseContent();
    } catch (err) { console.error('Erro ao carregar perfil do Firebase:', err); showToast('Aviso', 'Login realizado, mas alguns dados não puderam ser carregados. Confira as regras do Firestore.', 'fa-triangle-exclamation'); }
  }

  async function loadFirebaseContent() {
    if (!window.firebaseBridge) return;
    try {
      propertyList = await window.firebaseBridge.loadProperties();
      const reviews = await window.firebaseBridge.loadReviews(); ownersDatabase = {};
      reviews.forEach(review => { const key = review.targetOwnerId || review.targetOwnerName || 'unknown'; if (!ownersDatabase[key]) ownersDatabase[key] = { uid: review.targetOwnerId || '', name: review.targetOwnerName || 'Proprietário', phone: '', avatar: '', memberSince: '', reviews: [] }; ownersDatabase[key].reviews.push(review); });
      if (propertyList.length && !currentFeatured) currentFeatured = propertyList[0];
      renderPropertiesVitrine(); updateFeaturedUI();
    } catch (err) { console.error('Erro carregando dados:', err); showToast('Erro ao carregar anúncios', 'Confira as regras do Firestore no arquivo LEIA-ME.', 'fa-triangle-exclamation'); }
  }

  async function logoutUser() {
    try { if (window.firebaseBridge) await window.firebaseBridge.logout(); } catch (err) { console.error('Erro ao sair:', err); }
    currentUser = { isLoggedIn: false, uid: '', name: '', email: '', phone: '', avatar: '', memberSince: '' };
    const authForm = document.getElementById('auth-form'); if (authForm) authForm.reset();
    document.getElementById('auth-avatar-preview').classList.add('hidden'); document.getElementById('auth-avatar-placeholder').classList.remove('hidden');
    updateAuthUI(); showToast('Desconectado', 'Você saiu da sua conta.', 'fa-arrow-right-from-bracket'); showMainView();
  }

  function filterMyProperties() {
    const myProps = propertyList.filter(p => p.ownerName === currentUser.name || p.ownerPhone === currentUser.phone);
    if (myProps.length === 0) {
      showToast('Minhas Publicações', 'Você ainda não possui nenhum imóvel publicado.', 'fa-info-circle');
    } else {
      showMainView('#destaque');
      setAsFeatured(myProps[0].id);
      showToast('Minhas Publicações', `Mostrando suas publicações (${myProps.length} imóvel).`, 'fa-house');
    }
  }

  // Reviews System
  let currentViewedOwner = null;

  function renderOwnerReviewsAndScore(owner) {
    const reviews = owner.reviews || [];
    const countEl = document.getElementById('owner-page-reviews-count');
    const scoreEl = document.getElementById('owner-page-score');
    const starsContainer = document.getElementById('owner-page-stars');
    const reviewsList = document.getElementById('owner-page-reviews-list');

    countEl.textContent = `(${reviews.length} avaliações)`;

    let avg = 5.0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + Number(r.stars), 0);
      avg = (sum / reviews.length).toFixed(1);
    }
    scoreEl.textContent = avg;

    // Render stars
    starsContainer.innerHTML = '';
    const fullStars = Math.floor(avg);
    const hasHalf = avg - fullStars >= 0.5;
    for (let i = 0; i < fullStars; i++) {
      starsContainer.innerHTML += '<i class="fa-solid fa-star"></i>';
    }
    if (hasHalf) {
      starsContainer.innerHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
    }
    while (starsContainer.children.length < 5) {
      starsContainer.innerHTML += '<i class="fa-regular fa-star"></i>';
    }

    // List reviews
    reviewsList.innerHTML = '';
    if (reviews.length === 0) {
      reviewsList.innerHTML = '<p class="text-xs text-slate-500 py-2">Nenhuma avaliação deixada ainda. Seja o primeiro a avaliar!</p>';
    } else {
      reviews.forEach(r => {
        const item = document.createElement('div');
        item.className = 'p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-1';
        let starIcons = '';
        for (let s = 0; s < r.stars; s++) starIcons += '<i class="fa-solid fa-star text-yellow-400"></i> ';
        item.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-bold text-white">${r.author}</span>
            <span class="text-[10px] text-slate-400">${r.date || 'Recente'}</span>
          </div>
          <div class="text-[11px]">${starIcons}</div>
          <p class="text-slate-300 text-[11px] mt-1">${r.text}</p>
        `;
        reviewsList.appendChild(item);
      });
    }
  }

  function openReviewModal() {
    if (!currentViewedOwner) return;
    document.getElementById('review-modal-target-name').textContent = `Avaliando ${currentViewedOwner.name}`;
    document.getElementById('review-modal').classList.remove('hidden');
    setModalStarRating(5);
  }

  function closeReviewModal() {
    document.getElementById('review-modal').classList.add('hidden');
  }

  function setModalStarRating(num) {
    document.getElementById('review-star-val').value = num;
    const stars = document.querySelectorAll('#star-rating-selector i');
    stars.forEach((s, idx) => {
      if (idx < num) {
        s.className = 'fa-solid fa-star text-yellow-400';
      } else {
        s.className = 'fa-regular fa-star text-slate-600';
      }
    });
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!currentViewedOwner) return;
    if (!currentUser.isLoggedIn || !currentUser.uid) { showToast('Entre para avaliar', 'Faça login antes de enviar uma avaliação.', 'fa-lock'); openAuthModal(false); return; }
    if (currentViewedOwner.uid && currentViewedOwner.uid === currentUser.uid) { showToast('Ação não permitida', 'Você não pode avaliar a própria conta.', 'fa-ban'); return; }
    const author = document.getElementById('review-author').value.trim();
    const text = document.getElementById('review-text').value.trim();
    const stars = Number(document.getElementById('review-star-val').value);

    const review = { author: currentUser.name || author, text, stars, date: 'Hoje', authorId: currentUser.uid, targetOwnerId: currentViewedOwner.uid || '', targetOwnerName: currentViewedOwner.name };
    try { await window.firebaseBridge.saveReview(review); currentViewedOwner.reviews.unshift(review); }
    catch (err) { console.error('Erro salvando avaliação:', err); showToast('Falha ao salvar', window.firebaseBridge?.friendlyError(err) || 'Não foi possível salvar a avaliação.', 'fa-triangle-exclamation'); return; }
    renderOwnerReviewsAndScore(currentViewedOwner);
    closeReviewModal();
    showToast('Avaliação Registrada', 'Obrigado por contribuir com a comunidade OpenWord!', 'fa-star');
    document.getElementById('review-author').value = '';
    document.getElementById('review-text').value = '';
  }

  // CURRENCY MASK IN REAL TIME
  function handlePriceMask(input) {
    let value = input.value.replace(/\D/g, '');
    if (!value) {
      input.value = '';
      return;
    }
    let numberVal = parseFloat(value) / 100;
    input.value = numberVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCurrencyInputLive() {
    const input = document.getElementById('prop-price');
    if (input.value) {
      handlePriceMask(input);
    }
  }

  // POSIÇÃO SOLAR (STRICT 2 OPÇÕES)
  function selectSunPosition(choice) {
    document.getElementById('prop-sun').value = choice || '';
    const btnSol = document.getElementById('sun-btn-sol');
    const btnSombra = document.getElementById('sun-btn-sombra');
    const inactive = 'sun-choice-btn py-2 px-1.5 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1 transition min-h-[42px]';
    btnSol.className = inactive;
    btnSombra.className = inactive;
    if (choice === 'Lado do Sol') btnSol.className = 'sun-choice-btn py-2 px-1.5 rounded-xl border border-neon bg-neon/15 text-neon text-[11px] font-bold flex items-center justify-center gap-1 transition min-h-[42px]';
    if (choice === 'Lado da Sombra') btnSombra.className = 'sun-choice-btn py-2 px-1.5 rounded-xl border border-cyan-400 bg-cyan-400/15 text-cyan-300 text-[11px] font-bold flex items-center justify-center gap-1 transition min-h-[42px]';
  }

  function updateLotOptions() {
    const type = document.getElementById('prop-type').value;
    const optional = document.getElementById('prop-lot-optional');
    const lot = document.getElementById('prop-meters');
    const mark = document.getElementById('lot-required-mark');
    const isLeisure = type === 'lazer';
    optional.disabled = !isLeisure;
    if (!isLeisure) optional.checked = false;
    lot.required = !(isLeisure && optional.checked);
    lot.disabled = isLeisure && optional.checked;
    if (lot.disabled) lot.value = '';
    mark.classList.toggle('hidden', !lot.required);
  }

  function populateRoomSelectors() {
    [['prop-rooms', 20], ['prop-livingrooms', 20], ['prop-kitchens', 10], ['prop-baths', 20]].forEach(([id, max]) => {
      const select = document.getElementById(id);
      if (!select || select.options.length > 1) return;
      for (let n = 0; n <= max; n++) {
        const option = document.createElement('option');
        option.value = String(n);
        option.textContent = String(n);
        select.appendChild(option);
      }
    });
  }

  // MULTIPLE PHOTOS MANAGEMENT
  async function handleMultiplePhotoUpload(input) {
    if (!input.files || !input.files.length) return;
    const files = Array.from(input.files);
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try { uploadedPhotos.push(await compressImageFile(file, 95000, 1200)); renderUploadedPhotosGrid(); }
      catch (err) { showToast('Foto não carregada', err.message || 'Tente uma imagem menor.', 'fa-image'); }
    }
    input.value = '';
  }

  function addPhotoFromUrl() {
    const urlInput = document.getElementById('prop-image-url');
    const url = urlInput.value.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image'))) {
      uploadedPhotos.push(url);
      urlInput.value = '';
      renderUploadedPhotosGrid();
      showToast('Foto Adicionada', 'Imagem adicionada à galeria.', 'fa-image');
    } else {
      showToast('URL Inválida', 'Insira uma URL de imagem válida com http:// ou https://', 'fa-triangle-exclamation');
    }
  }

  function removeUploadedPhoto(idx) {
    uploadedPhotos.splice(idx, 1);
    renderUploadedPhotosGrid();
  }

  function clearAllUploadedPhotos() {
    uploadedPhotos = [];
    renderUploadedPhotosGrid();
  }

  function renderUploadedPhotosGrid() {
    const grid = document.getElementById('photo-preview-grid');
    const countLabel = document.getElementById('photos-count-label');
    const clearBtn = document.getElementById('clear-all-photos-btn');
    
    countLabel.textContent = uploadedPhotos.length;
    grid.innerHTML = '';

    if (uploadedPhotos.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-4 text-center text-slate-600 text-xs flex flex-col items-center justify-center" id="empty-photos-notice">
          <i class="fa-regular fa-images text-xl mb-1 text-slate-700"></i>
          <span>Nenhuma foto carregada ainda.</span>
        </div>
      `;
      clearBtn.classList.add('hidden');
      return;
    }

    clearBtn.classList.remove('hidden');

    uploadedPhotos.forEach((src, idx) => {
      const item = document.createElement('div');
      item.className = 'relative group aspect-square rounded-xl overflow-hidden border border-slate-700 bg-black/60 shadow';
      item.innerHTML = `
        <img src="${src}" class="w-full h-full object-cover">
        <span class="absolute top-1 left-1 bg-black/75 text-[9px] font-bold text-white px-1 py-0.2 rounded">#${idx + 1}</span>
        <button type="button" onclick="removeUploadedPhoto(${idx})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center text-[10px] opacity-90 group-hover:opacity-100 hover:bg-red-500 transition shadow">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      grid.appendChild(item);
    });
  }

  // Update Featured UI
  function updateFeaturedUI() {
    const featuredCard = document.getElementById('featured-content-card');
    const emptyCard = document.getElementById('featured-empty-card');

    if (!currentFeatured) {
      featuredCard.classList.add('hidden');
      emptyCard.classList.remove('hidden');
      return;
    }

    emptyCard.classList.add('hidden');
    featuredCard.classList.remove('hidden');

    const mainImg = document.getElementById('featured-main-img');
    const indicator = document.getElementById('carousel-indicator');
    const thumbContainer = document.getElementById('thumb-container');
    const cfg = typeConfig[currentFeatured.type] || typeConfig.aluguel;

    if (featuredPhotoIndex >= currentFeatured.photos.length) featuredPhotoIndex = 0;
    mainImg.src = currentFeatured.photos[featuredPhotoIndex];
    indicator.textContent = `Foto ${featuredPhotoIndex + 1} de ${currentFeatured.photos.length} • ${currentFeatured.title}`;

    thumbContainer.innerHTML = '';
    currentFeatured.photos.forEach((photoUrl, idx) => {
      const thumb = document.createElement('img');
      thumb.src = photoUrl;
      thumb.className = `w-12 h-9 sm:w-14 sm:h-10 object-cover rounded-lg cursor-pointer border-2 transition shrink-0 ${idx === featuredPhotoIndex ? 'border-neon scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'}`;
      thumb.onclick = () => {
        featuredPhotoIndex = idx;
        updateFeaturedUI();
      };
      thumbContainer.appendChild(thumb);
    });

    document.getElementById('featured-title').textContent = currentFeatured.title;
    document.getElementById('featured-price-label').textContent = currentFeatured.priceLabel;
    document.getElementById('featured-price').textContent = currentFeatured.price;
    document.getElementById('featured-price').style.color = cfg.color;
    document.getElementById('featured-meters').textContent = currentFeatured.meters || 'Não informado';
    const descWrap = document.getElementById('featured-description-wrap');
    const description = currentFeatured.description || '';
    document.getElementById('featured-description').textContent = description;
    descWrap.classList.toggle('hidden', !description.trim());

    document.getElementById('featured-owner-name').textContent = currentFeatured.ownerName;
    document.getElementById('featured-owner-phone').textContent = currentFeatured.ownerPhone;
    
    const ownerPhotoEl = document.getElementById('featured-owner-photo');
    if (currentFeatured.ownerPhoto) {
      ownerPhotoEl.src = currentFeatured.ownerPhoto;
      ownerPhotoEl.classList.remove('hidden');
    } else {
      ownerPhotoEl.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
    }
    
    const typeTag = document.getElementById('featured-type-tag');
    typeTag.textContent = currentFeatured.typeLabel;
    typeTag.style.color = cfg.color;
    typeTag.style.borderColor = cfg.color;
    typeTag.style.backgroundColor = cfg.bg;

    document.getElementById('feat-quartos').innerHTML = `<strong>${currentFeatured.rooms.quartos ?? '—'}</strong> Quartos`;
    document.getElementById('feat-salas').innerHTML = `<strong>${currentFeatured.rooms.salas ?? '—'}</strong> Salas`;
    document.getElementById('feat-banheiros').innerHTML = `<strong>${currentFeatured.rooms.banheiros ?? '—'}</strong> Banheiros`;
    document.getElementById('feat-cozinha').innerHTML = `<strong>${currentFeatured.rooms.cozinhas ?? '—'}</strong> Cozinha(s)`;
    
    document.getElementById('feat-sol').textContent = currentFeatured.rooms.sol;
    const solIcon = document.getElementById('feat-sol-icon');
    if (currentFeatured.rooms.sol === 'Lado da Sombra') {
      solIcon.innerHTML = '<i class="fa-solid fa-cloud-sun text-cyan-300 w-4 text-center"></i>';
    } else {
      solIcon.innerHTML = '<i class="fa-solid fa-sun text-yellow-400 w-4 text-center"></i>';
    }

    let fullAddr = `${currentFeatured.address}, Nº ${currentFeatured.houseNumber || 'S/N'}`;
    document.getElementById('featured-address-badge').innerHTML = `<i class="fa-solid fa-location-dot mr-1" style="color:${cfg.color}"></i> ${fullAddr}`;

    const refBadge = document.getElementById('featured-ref-badge');
    if (currentFeatured.reference) {
      refBadge.classList.remove('hidden');
      refBadge.querySelector('span').textContent = currentFeatured.reference;
    } else {
      refBadge.classList.add('hidden');
    }
    
    document.getElementById('featured-published-time').innerHTML = `<i class="fa-regular fa-clock mr-1"></i> Publicado ${currentFeatured.publishedAt}`;
    document.getElementById('featured-code').textContent = `Cód: ${currentFeatured.code}`;

    let cleanPhone = currentFeatured.ownerPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    const whatsMsg = encodeURIComponent(`Olá, vi o anúncio no OpenWord: "${currentFeatured.title}" (${currentFeatured.price}). Ainda está disponível?`);
    const contactUrl = `https://wa.me/${cleanPhone}?text=${whatsMsg}`;
    document.getElementById('featured-whatsapp-btn').href = contactUrl;
    document.getElementById('featured-contact-btn').href = contactUrl;
  }

  function prevFeaturedImg() {
    if (!currentFeatured || !currentFeatured.photos.length) return;
    featuredPhotoIndex = (featuredPhotoIndex - 1 + currentFeatured.photos.length) % currentFeatured.photos.length;
    updateFeaturedUI();
  }

  function nextFeaturedImg() {
    if (!currentFeatured || !currentFeatured.photos.length) return;
    featuredPhotoIndex = (featuredPhotoIndex + 1) % currentFeatured.photos.length;
    updateFeaturedUI();
  }

  function openLightboxFromFeatured() {
    if (!currentFeatured || !currentFeatured.photos.length) return;
    openLightbox(currentFeatured.photos[featuredPhotoIndex], currentFeatured.title);
  }

  function openLightbox(imgSrc, title) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    img.src = imgSrc;
    caption.textContent = title || 'Visualização em Alta Definição';
    modal.classList.remove('hidden');
  }

  function closeLightbox() {
    document.getElementById('lightbox-modal').classList.add('hidden');
  }

  // Render Horizontal Slider
  function renderPropertiesVitrine() {
    const slider = document.getElementById('properties-slider');
    slider.innerHTML = '';

    const filtered = activeFilter === 'todos' 
      ? propertyList 
      : propertyList.filter(p => p.type === activeFilter);

    document.getElementById('count-todos').textContent = propertyList.length;
    document.getElementById('slider-count-info').textContent = `Exibindo ${filtered.length} de ${propertyList.length} imóveis`;

    if (filtered.length === 0) {
      slider.innerHTML = `
        <div class="w-full py-10 sm:py-14 px-4 text-center rounded-2xl bg-cardnavy/40 border border-slate-800/80 my-1">
          <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-2.5 text-slate-500 text-xl">
            <i class="fa-regular fa-folder-open"></i>
          </div>
          <h4 class="text-sm sm:text-base font-bold text-white mb-1">Nenhum imóvel anunciado ainda</h4>
          <p class="text-xs text-slate-400 max-w-sm mx-auto mb-3.5">Clique em Anunciar Imóvel para cadastrar sua publicação no feed!</p>
          <button onclick="handleAnnounceClick()" class="px-5 py-2.5 min-h-[40px] rounded-xl bg-neon text-darknavy font-bold text-xs hover:bg-neon-hover shadow-neon transition inline-flex items-center gap-1.5">
            <i class="fa-solid fa-plus"></i> Anunciar Imóvel
          </button>
        </div>
      `;
      return;
    }

    filtered.forEach((prop) => {
      const cfg = typeConfig[prop.type] || typeConfig.aluguel;
      let cleanPhone = prop.ownerPhone.replace(/\D/g, '');
      if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
        cleanPhone = `55${cleanPhone}`;
      }
      const whatsMsg = encodeURIComponent(`Olá, vi o anúncio no OpenWord: "${prop.title}" (${prop.price}). Está disponível?`);
      const fullDisplayAddr = `${prop.address}, Nº ${prop.houseNumber || 'S/N'}`;
      
      const card = document.createElement('div');
      card.className = 'w-[260px] xs:w-[285px] sm:w-[340px] shrink-0 bg-cardnavy/95 border border-cyan-900/50 hover:border-neon/70 rounded-2xl p-3 sm:p-4 shadow-xl transition-all duration-300 flex flex-col justify-between group';
      
      card.innerHTML = `
        <div class="relative w-full h-40 sm:h-48 rounded-xl overflow-hidden bg-black/60 border border-slate-800 flex items-center justify-center">
          <img src="${prop.photos[0]}" alt="${prop.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer" onclick="openLightbox('${prop.photos[0]}', '${prop.title}')">
          <span class="absolute top-2 left-2 text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-md" style="background:${cfg.bg}; color:${cfg.color}; border: 1px solid ${cfg.border}; backdrop-filter: blur(4px);">
            ${prop.typeLabel}
          </span>
          <button class="absolute top-2 right-2 w-7 h-7 rounded-full bg-darknavy/80 hover:bg-neon hover:text-darknavy text-white flex items-center justify-center transition" onclick="openLightbox('${prop.photos[0]}', '${prop.title}')" title="Ampliar Foto">
            <i class="fa-solid fa-magnifying-glass-plus text-[10px]"></i>
          </button>
          <span class="absolute bottom-2 right-2 text-[10px] bg-black/75 px-1.5 py-0.5 rounded text-slate-300">
            <i class="fa-solid fa-camera mr-0.5"></i> ${prop.photos.length} fotos
          </span>
        </div>

        <div class="pt-2.5 flex-grow flex flex-col justify-between">
          <div>
            <div class="flex items-baseline justify-between gap-1">
              <h3 class="font-extrabold text-white text-xs sm:text-sm truncate" title="${prop.title}">${prop.title}</h3>
            </div>
            <p class="text-[11px] text-slate-300 truncate mt-0.5" title="${fullDisplayAddr}"><i class="fa-solid fa-location-dot text-neon mr-1"></i> ${fullDisplayAddr}</p>
            ${prop.reference ? `<p class="text-[10px] text-cyan-300/80 truncate mt-0.5"><i class="fa-solid fa-compass mr-1"></i> ${prop.reference}</p>` : ''}

            <div class="mt-2 flex items-baseline justify-between border-b border-slate-800/80 pb-1.5">
              <div>
                <span class="text-[9px] uppercase text-slate-500 block">${prop.priceLabel}</span>
                <span class="text-base sm:text-lg font-black" style="color: ${cfg.color}">${prop.price}</span>
              </div>
              <span class="text-[11px] font-semibold text-slate-300">${prop.meters}</span>
            </div>

            <div class="grid grid-cols-2 gap-1 py-2 text-[10px] sm:text-[11px] text-slate-300 border-b border-slate-800/60">
              <span class="flex items-center gap-1"><i class="fa-solid fa-bed text-neon text-[9px]"></i> ${prop.rooms.quartos} quartos</span>
              <span class="flex items-center gap-1"><i class="fa-solid fa-couch text-neon text-[9px]"></i> ${prop.rooms.salas ?? '—'} salas</span>
              <span class="flex items-center gap-1"><i class="fa-solid fa-bath text-neon text-[9px]"></i> ${prop.rooms.banheiros} banheiros</span>
              <span class="flex items-center gap-1"><i class="fa-solid fa-utensils text-neon text-[9px]"></i> ${prop.rooms.cozinhas} cozinhas</span>
            </div>
            
            <div class="py-1 text-[10px] sm:text-[11px] text-slate-400 flex items-center justify-between">
              <span class="truncate">
                ${prop.rooms.sol === 'Lado da Sombra' ? '<i class="fa-solid fa-cloud-sun text-cyan-300 mr-1"></i>' : '<i class="fa-solid fa-sun text-yellow-400 mr-1"></i>'}
                ${prop.rooms.sol}
              </span>
            </div>
          </div>

          <div class="pt-2 mt-1.5 border-t border-slate-800/70">
            <!-- Owner Preview clicável para perfil profissional -->
            <div class="flex items-center justify-between gap-1.5 cursor-pointer hover:opacity-90" onclick="showOwnerProfile({ name: '${prop.ownerName}', phone: '${prop.ownerPhone}', avatar: '${prop.ownerPhoto || ''}' })" title="Ver Perfil Profissional">
              <div class="flex items-center gap-1.5 min-w-0">
                <img src="${prop.ownerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}" alt="${prop.ownerName}" class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-neon shrink-0">
                <div class="truncate">
                  <div class="text-[11px] font-bold text-white truncate hover:text-neon">${prop.ownerName}</div>
                  <div class="text-[9px] text-slate-400 font-mono">${prop.ownerPhone}</div>
                </div>
              </div>

              <a href="https://wa.me/${cleanPhone}?text=${whatsMsg}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition flex items-center gap-1 shrink-0 shadow">
                <i class="fa-brands fa-whatsapp text-xs"></i>
                <span class="hidden xs:inline">WhatsApp</span>
              </a>
            </div>

            <div class="mt-2 flex items-center gap-2">
              <button onclick="setAsFeatured('${prop.id}')" class="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-neon hover:text-darknavy text-slate-200 text-[11px] font-bold transition border border-slate-700 hover:border-neon flex items-center justify-center gap-1">
                <i class="fa-solid fa-star text-yellow-400"></i> Ver no Destaque
              </button>
              ${currentUser.isLoggedIn && prop.ownerId === currentUser.uid ? `<button onclick="deleteProperty('${prop.id}')" class="py-1.5 px-2 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-200 text-[11px] font-bold transition border border-red-900 flex items-center justify-center gap-1" title="Apagar meu anúncio"><i class="fa-solid fa-trash"></i> Apagar</button>` : ''}
            </div>

            <div class="mt-1.5 text-[9px] text-slate-500 flex items-center justify-between">
              <span>Publicado ${prop.publishedAt}</span>
              <span>${prop.code}</span>
            </div>
          </div>
        </div>
      `;
      
      slider.appendChild(card);
    });
  }

  async function deleteProperty(propId) {
    const property = propertyList.find(p => p.id === propId);
    if (!property) return;
    if (!currentUser.isLoggedIn || property.ownerId !== currentUser.uid) {
      showToast('Ação não permitida', 'Você só pode apagar os anúncios publicados pela sua própria conta.', 'fa-lock');
      return;
    }
    if (!confirm(`Tem certeza que deseja apagar o anúncio "${property.title}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await window.firebaseBridge.deleteProperty(propId);
      propertyList = propertyList.filter(p => p.id !== propId);
      if (currentFeatured?.id === propId) currentFeatured = propertyList[0] || null;
      renderPropertiesVitrine();
      updateFeaturedUI();
      showToast('Anúncio apagado', 'Seu imóvel foi removido da plataforma.', 'fa-trash');
    } catch (err) {
      console.error('Erro apagando anúncio:', err);
      showToast('Não foi possível apagar', window.firebaseBridge?.friendlyError(err) || 'Confira sua conexão e as regras do Firestore.', 'fa-triangle-exclamation');
    }
  }

  function scrollCarousel(direction) {
    const slider = document.getElementById('properties-slider');
    const scrollAmount = window.innerWidth < 640 ? 270 : 350;
    slider.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  }

  function filterProperties(category) {
    activeFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('bg-neon', 'text-darknavy', 'shadow-neon');
      btn.classList.add('bg-transparent');
    });

    const activeBtn = document.getElementById(`filter-btn-${category}`);
    if (activeBtn) {
      activeBtn.classList.remove('bg-transparent');
      activeBtn.classList.add('bg-neon', 'text-darknavy', 'shadow-neon');
    }

    renderPropertiesVitrine();
  }

  function setAsFeatured(propId) {
    const found = propertyList.find(p => p.id === propId);
    if (found) {
      currentFeatured = found;
      featuredPhotoIndex = 0;
      updateFeaturedUI();
      document.getElementById('destaque').scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Modal Multi-step Logic
  let currentStep = 1;

  function openModal() {
    if (!currentUser.isLoggedIn) {
      handleAnnounceClick();
      return;
    }
    const avatarEl = document.getElementById('form-user-preview-avatar');
    if (currentUser.avatar) {
      avatarEl.src = currentUser.avatar;
    } else {
      avatarEl.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
    }
    document.getElementById('form-user-preview-name').textContent = `Logado como ${currentUser.name}`;
    document.getElementById('form-user-preview-phone').textContent = `WhatsApp: ${currentUser.phone}`;

    document.getElementById('announce-modal').classList.remove('hidden');
    goToStep(1);
  }

  function closeModal() {
    document.getElementById('announce-modal').classList.add('hidden');
  }

  function updatePriceLabelByType() {
    const type = document.getElementById('prop-type').value;
    const label = document.getElementById('form-price-label');
    if (type === 'aluguel') label.innerHTML = 'Valor Mensal <span class="text-neon">*</span>';
    else if (type === 'lazer') label.innerHTML = 'Valor Diária <span class="text-neon">*</span>';
    else label.innerHTML = 'Valor de Venda <span class="text-neon">*</span>';
  }

  function goToStep(step) {
    if (step === 2 && currentStep === 1) {
      const title = document.getElementById('prop-title').value.trim();
      const address = document.getElementById('prop-address').value.trim();
      const houseNumber = document.getElementById('prop-number').value.trim();

      if (!title || !address || !houseNumber) {
        showToast('Campos Obrigatórios', 'Preencha o título, endereço e número da casa.', 'fa-triangle-exclamation');
        return;
      }
    }

    if (step === 3 && currentStep === 2) {
      const price = document.getElementById('prop-price').value.trim();
      const type = document.getElementById('prop-type').value;
      const meters = document.getElementById('prop-meters').value.trim();
      const rooms = document.getElementById('prop-rooms').value;
      const livingRooms = document.getElementById('prop-livingrooms').value;
      const baths = document.getElementById('prop-baths').value;
      const kitchens = document.getElementById('prop-kitchens').value;
      const sun = document.getElementById('prop-sun').value;
      const lotOptional = document.getElementById('prop-lot-optional').checked;

      if (!type || !price || (!meters && !(type === 'lazer' && lotOptional)) || rooms === '' || livingRooms === '' || baths === '' || kitchens === '' || !sun) {
        showToast('Campos Obrigatórios', 'Selecione a finalidade, a posição solar, informe o valor e selecione a quantidade de cada cômodo. O lote pode ficar vazio apenas em imóvel de lazer com a opção marcada.', 'fa-triangle-exclamation');
        return;
      }
    }

    currentStep = step;
    document.getElementById('form-step-1').classList.toggle('hidden', step !== 1);
    document.getElementById('form-step-2').classList.toggle('hidden', step !== 2);
    document.getElementById('form-step-3').classList.toggle('hidden', step !== 3);

    const progress = (step / 3) * 100;
    document.getElementById('step-progress-bar').style.width = `${progress}%`;
    document.getElementById('step-badge').textContent = `Etapa ${step} de 3`;
  }

  // Free ViaCEP lookup
  async function fetchAddressByCEP() {
    const cepInput = document.getElementById('prop-cep');
    const addressInput = document.getElementById('prop-address');
    const loader = document.getElementById('cep-loader');
    
    const cleanCep = cepInput.value.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      loader.classList.remove('hidden');
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          addressInput.value = `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`;
          showToast('Endereço Localizado', `${data.logradouro} - ${data.localidade}`, 'fa-location-dot');
          document.getElementById('prop-number').focus();
        } else {
          showToast('CEP não encontrado', 'Digite o endereço e número manualmente.', 'fa-circle-exclamation');
        }
      } catch (err) {
        console.error('Erro na consulta ViaCEP:', err);
      } finally {
        loader.classList.add('hidden');
      }
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentUser.isLoggedIn) {
      closeModal();
      openAuthModal(true);
      return;
    }

    if (uploadedPhotos.length === 0) {
      showToast('Fotos Necessárias', 'Adicione pelo menos 1 foto do imóvel para publicar.', 'fa-image');
      return;
    }

    const title = document.getElementById('prop-title').value.trim();
    const address = document.getElementById('prop-address').value.trim();
    const houseNumber = document.getElementById('prop-number').value.trim();
    const reference = document.getElementById('prop-reference').value.trim();

    const type = document.getElementById('prop-type').value;
    const currencySelect = document.getElementById('prop-currency');
    const currencyOption = currencySelect.options[currencySelect.selectedIndex];
    const currencySymbol = currencyOption.getAttribute('data-symbol') || 'R$';
    const priceVal = document.getElementById('prop-price').value.trim();

    const metersVal = document.getElementById('prop-meters').value.trim();
    const roomsVal = document.getElementById('prop-rooms').value;
    const livingRoomsVal = document.getElementById('prop-livingrooms').value;
    const bathsVal = document.getElementById('prop-baths').value;
    const kitchensVal = document.getElementById('prop-kitchens').value;
    const sunVal = document.getElementById('prop-sun').value;
    const descriptionVal = document.getElementById('prop-description').value.trim();

    const formattedPrice = `${currencySymbol} ${priceVal}`;
    
    let priceLabel = 'Valor Mensal';
    let typeLabel = 'Aluguel';
    if (type === 'venda') {
      priceLabel = 'Valor de Venda';
      typeLabel = 'Venda';
    } else if (type === 'lazer') {
      priceLabel = 'Valor Diária';
      typeLabel = 'Área de Lazer';
    }

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const publishedTime = `Hoje às ${hours}:${mins}`;

    const newProperty = {
      id: `prop-${Date.now()}`,
      title: title,
      type: type,
      typeLabel: typeLabel,
      priceLabel: priceLabel,
      price: formattedPrice,
      meters: metersVal || 'Não informado',
      description: descriptionVal,
      address: address,
      houseNumber: houseNumber,
      reference: reference,
      ownerId: currentUser.uid,
      ownerName: currentUser.name,
      ownerPhone: currentUser.phone,
      ownerPhoto: currentUser.avatar,
      publishedAt: publishedTime,
      code: `#OPW-${Math.floor(1000 + Math.random() * 9000)}`,
      rooms: {
        quartos: roomsVal,
        banheiros: bathsVal,
        cozinhas: kitchensVal,
        salas: livingRoomsVal,
        sol: sunVal
      },
      photos: [...uploadedPhotos]
    };

    const embeddedPhotoBytes = newProperty.photos.filter(src => src.startsWith('data:image')).reduce((sum, src) => sum + src.length, 0);
    if (embeddedPhotoBytes > 720000) { showToast('Fotos excedem o limite do banco', 'Não há limite fixo de quantidade, mas fotos enviadas do aparelho precisam caber no limite do Firestore. Comprima as imagens ou adicione fotos por URL.', 'fa-image'); return; }
    try { await window.firebaseBridge.saveProperty(newProperty); }
    catch (err) { console.error('Erro salvando imóvel:', err); showToast('Não foi possível publicar', window.firebaseBridge?.friendlyError(err) || 'Confira a conexão e as regras do Firestore.', 'fa-triangle-exclamation'); return; }
    propertyList.unshift(newProperty);
    currentFeatured = newProperty;
    featuredPhotoIndex = 0;
    
    updateFeaturedUI();
    renderPropertiesVitrine();

    // Registra dono na base de perfis
    const ownerKey = currentUser.phone || currentUser.name;
    if (!ownersDatabase[ownerKey]) {
      ownersDatabase[ownerKey] = {
        uid: currentUser.uid,
        name: currentUser.name,
        phone: currentUser.phone,
        avatar: currentUser.avatar,
        memberSince: currentUser.memberSince || '',
        reviews: []
      };
    }

    // Reset Form
    document.getElementById('property-form').reset();
    uploadedPhotos = [];
    renderUploadedPhotosGrid();
    selectSunPosition('');
    document.getElementById('prop-lot-optional').checked = false;
    updateLotOptions();
    
    closeModal();
    showToast('Publicado com Sucesso!', 'Seu imóvel foi adicionado e está em destaque.', 'fa-circle-check');
    showMainView('#destaque');
  }

  window.deleteProperty = deleteProperty;
  window.updateLotOptions = updateLotOptions;
  window.checkEmailVerification = checkEmailVerification;
  window.resendEmailVerification = resendEmailVerification;
  window.toggleAuthMode = toggleAuthMode;

  // Init page; Firebase restores the session and loads cloud content.
  window.addEventListener('DOMContentLoaded', () => {
    populateRoomSelectors(); updateLotOptions(); updateAuthUI(); updateFeaturedUI(); renderPropertiesVitrine();
    if (window.firebaseBridgeReady) window.firebaseBridgeReady.then(() => window.firebaseBridge.startAuthListener(applyFirebaseUser)).catch(err => { console.error('Firebase não iniciou:', err); showToast('Firebase', 'Não foi possível iniciar o Firebase. Confira a configuração e a hospedagem.', 'fa-triangle-exclamation'); });
  });
