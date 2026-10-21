import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendEmailVerification, signOut,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

// Configuração do app Web fornecida pelo proprietário do projeto Firebase.
const firebaseConfig = {
  apiKey: 'AIzaSyDtHQXMA--UbYCxjXeG54AZaiqkHFCR2d0',
  authDomain: 'sitemundo-c2f7d.firebaseapp.com',
  projectId: 'sitemundo-c2f7d',
  storageBucket: 'sitemundo-c2f7d.firebasestorage.app',
  messagingSenderId: '205867756718',
  appId: '1:205867756718:web:da7c4f403bb43cf487113f',
  measurementId: 'G-K1JMCQZ3DZ'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const monthLabel = () => {
  const s = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function saveUserProfile(user, extra = {}) {
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);
  const previous = existing.exists() ? existing.data() : {};
  const profile = {
    uid: user.uid,
    name: extra.name || user.displayName || previous.name || (user.email || '').split('@')[0],
    email: user.email || previous.email || '',
    phone: extra.phone || previous.phone || '',
    avatar: extra.avatar || user.photoURL || previous.avatar || '',
    memberSince: previous.memberSince || monthLabel(),
    provider: user.providerData?.map(p => p.providerId) || [],
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, profile, { merge: true });
  return { ...previous, ...profile, memberSince: profile.memberSince };
}

function friendlyError(err) {
  const code = err?.code || '';
  const messages = {
    'auth/invalid-email': 'O formato do e-mail é inválido.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Este e-mail já possui cadastro. Entre com a senha ou use o Google.',
    'auth/invalid-credential': 'E-mail ou senha incorretos. Se a conta foi criada com Google, use o botão Google.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/user-not-found': 'Conta não encontrada. Para criar uma conta nova, preencha também seu nome e WhatsApp e tente novamente.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
    'auth/popup-blocked': 'O navegador bloqueou a janela. Permita pop-ups para este site.',
    'auth/unauthorized-domain': 'Este domínio ainda não está autorizado no Firebase Authentication.',
    'auth/operation-not-allowed': 'Ative este método de login no Firebase Authentication.',
    'permission-denied': 'O Firestore bloqueou a operação. Confira as regras de segurança.',
    'failed-precondition': 'O banco recusou a operação. Confira a configuração do Firestore.'
  };
  return messages[code] || (err?.message || 'Ocorreu um erro. Tente novamente.');
}

const bridge = {
  async emailPasswordFlow({ name, email, password, phone, avatar }) {
    const normalizedEmail = email.trim().toLowerCase();
    let userCredential;
    let isNew = false;
    try {
      if (!name || !phone) {
        // Tentativa de login antes de exigir os dados que só são necessários no cadastro.
        userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      } else {
        try {
          userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          isNew = true;
        } catch (createError) {
          if (createError.code !== 'auth/email-already-in-use') throw createError;
          userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        }
      }
    } catch (err) {
      throw err;
    }

    const user = userCredential.user;
    if (isNew) {
      try { await updateProfile(user, { displayName: name.trim() }); } catch (_) {}
      const profile = await saveUserProfile(user, { name: name.trim(), phone: phone.trim(), avatar: avatar || '' });
      await sendEmailVerification(user);
      await signOut(auth);
      return { needsVerification: true, profile };
    }

    await user.reload();
    if (!user.emailVerified) {
      try { await sendEmailVerification(user); } catch (_) {}
      await signOut(auth);
      return { needsVerification: true };
    }
    const profile = await saveUserProfile(user, { name: name.trim(), phone: phone.trim(), avatar: avatar || '' });
    return { user, profile };
  },

  async googleLogin() {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserProfile(result.user);
    return result.user;
  },

  async resendVerification({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    await credential.user.reload();
    if (credential.user.emailVerified) {
      await signOut(auth);
      return { alreadyVerified: true };
    }
    await sendEmailVerification(credential.user);
    await signOut(auth);
    return { sent: true };
  },

  async checkEmailVerification({ name, email, password, phone, avatar }) {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    await credential.user.reload();
    const user = credential.user;
    if (!user.emailVerified) {
      await signOut(auth);
      return { verified: false };
    }
    const profile = await saveUserProfile(user, { name: name.trim(), phone: phone.trim(), avatar: avatar || '' });
    return { verified: true, user, profile };
  },

  async sendPasswordReset(email) {
    return sendPasswordResetEmail(auth, email.trim().toLowerCase());
  },
  async logout() { return signOut(auth); },
  startAuthListener(callback) {
    return onAuthStateChanged(auth, async user => {
      if (user && user.email && !user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        await signOut(auth);
        callback(null);
        return;
      }
      callback(user);
    });
  },
  async getUserProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },
  async loadProperties() {
    const snap = await getDocs(collection(db, 'properties'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
  },
  async saveProperty(property) {
    if (!auth.currentUser) throw new Error('Faça login para publicar um imóvel.');
    if (property.ownerId !== auth.currentUser.uid) throw new Error('A conta autenticada não corresponde ao proprietário.');
    const data = { ...property, ownerId: auth.currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await setDoc(doc(db, 'properties', property.id), data);
  },
  async deleteProperty(propertyId) {
    if (!auth.currentUser) throw new Error('Faça login para apagar um anúncio.');
    const ref = doc(db, 'properties', propertyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Este anúncio já não existe.');
    if (snap.data().ownerId !== auth.currentUser.uid) throw new Error('Você só pode apagar anúncios da sua própria conta.');
    await deleteDoc(ref);
  },
  async loadReviews() {
    const snap = await getDocs(collection(db, 'reviews'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async saveReview(review) {
    if (!auth.currentUser) throw new Error('Faça login para avaliar.');
    if (!review.targetOwnerId) throw new Error('Este perfil não está vinculado a uma conta registrada.');
    await addDoc(collection(db, 'reviews'), { ...review, authorId: auth.currentUser.uid, createdAt: serverTimestamp() });
  },
  friendlyError
};

window.firebaseBridge = bridge;
window.firebaseBridgeReady = Promise.resolve(bridge);
