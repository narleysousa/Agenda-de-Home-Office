const CHAVE_ESTAGIARIOS = "homeoffice_estagiarios";
const CHAVE_AGENDAMENTOS = "homeoffice_agendamentos";
const CHAVE_USUARIO_ATUAL = "homeoffice_usuario_atual";
const CHAVE_TEMA = "homeoffice_tema";
const COLECAO_ESTAGIARIOS = "estagiarios";
const COLECAO_AGENDAMENTOS = "agendamentos";

const limitesPorNivel = Object.freeze({ 0: 0, 1: 1, 2: 2, 3: 4 });
const cargosPermitidos = ["usuario", "adm", "master"];
const statusPermitidos = ["pendente", "aprovado", "negado", "cancelado"];
const statusAtivosNaCota = ["pendente", "aprovado"];
const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const formLoginInicial = document.getElementById("form-login-inicial");
const selectUsuarioLoginInicial = document.getElementById("usuario-login-inicial");
const senhaLoginInicial = document.getElementById("senha-login-inicial");
const formAutoCadastro = document.getElementById("form-auto-cadastro");
const btnLogout = document.getElementById("btn-logout");
const seletorTema = document.getElementById("seletor-tema");
const usuarioAtualEl = document.getElementById("usuario-atual");

const formAgendamento = document.getElementById("form-agendamento");
const dataHomeInput = document.getElementById("data-home");
const cardCadastroUsuario = document.getElementById("card-cadastro-usuario");
const formCadastroUsuario = document.getElementById("form-cadastro-usuario");
const formFiltros = document.getElementById("form-filtros");
const filtroBusca = document.getElementById("filtro-busca");
const filtroStatus = document.getElementById("filtro-status");
const filtroMes = document.getElementById("filtro-mes");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");
const btnExportarCsv = document.getElementById("btn-exportar-csv");
const btnLimparAgendamentos = document.getElementById("btn-limpar-agendamentos");
const btnMesAnterior = document.getElementById("btn-mes-anterior");
const btnMesAtual = document.getElementById("btn-mes-atual");
const btnMesProximo = document.getElementById("btn-mes-proximo");

const cardSaldo = document.getElementById("card-saldo");
const calendarioMes = document.getElementById("calendario-mes");
const legendaCalendario = document.getElementById("legenda-calendario");
const tabelaEstagiarios = document.getElementById("tabela-estagiarios");
const tabelaAgendamentos = document.getElementById("tabela-agendamentos");
const tabelaPendentes = document.getElementById("tabela-pendentes");
const cardAprovacoes = document.getElementById("card-aprovacoes");
const mensagem = document.getElementById("mensagem");
const mensagemLogin = document.getElementById("mensagem-login");
const kpiTotalUsuarios = document.getElementById("kpi-total-usuarios");
const kpiPendentes = document.getElementById("kpi-pendentes");
const kpiAprovadosMes = document.getElementById("kpi-aprovados-mes");
const kpiTaxaAprovacao = document.getElementById("kpi-taxa-aprovacao");
const labelKpiTotalUsuarios = document.getElementById("label-kpi-total-usuarios");
const labelKpiPendentes = document.getElementById("label-kpi-pendentes");
const labelKpiAprovadosMes = document.getElementById("label-kpi-aprovados-mes");
const labelKpiTaxaAprovacao = document.getElementById("label-kpi-taxa-aprovacao");

const filtros = { busca: "", status: "", mes: "" };
let aprovacoesPendentesParaExportacao = [];
let db = null;
let auth = null;
let estagiariosCarregados = false;
let agendamentosCarregados = false;
let erroFirebase = "";
let migracaoPinsEmAndamento = false;
let bootstrapUsuarioEmAndamento = false;
let unsubscribeEstagiarios = null;
let unsubscribeAgendamentos = null;
const estadoRemoto = {
  estagiarios: [],
  agendamentos: [],
};

const pathname = window.location.pathname;
const estaNaPaginaLogin = pathname.endsWith("/index.html") || pathname.endsWith("index.html") || pathname.endsWith("/");
const estaNaPaginaApp = pathname.endsWith("/app.html") || pathname.endsWith("app.html");

function gerarId() {
  const aleatorio = Math.floor(Math.random() * 1000000);
  return `${Date.now()}_${aleatorio}`;
}

function escaparHtml(valor) {
  const mapa = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return String(valor ?? "").replace(/[&<>"']/g, (char) => mapa[char]);
}

function escaparAttr(valor) {
  return escaparHtml(valor);
}

function normalizarTexto(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pinValido(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}

async function hashPin(pin) {
  const bytes = new TextEncoder().encode(String(pin));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function dataHojeIso(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function mesAtualIso(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function dataIsoValida(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
}

function mesIsoValido(iso) {
  return /^\d{4}-\d{2}$/.test(String(iso || ""));
}

function criarDataLocal(iso) {
  if (!dataIsoValida(iso)) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function dataEhFimDeSemana(iso) {
  const data = criarDataLocal(iso);
  if (!data) return false;
  const dia = data.getDay();
  return dia === 0 || dia === 6;
}

function formatarData(iso) {
  if (!dataIsoValida(iso)) return "-";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso) {
  if (!iso) return "-";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function mesAnoDaData(iso) {
  if (!dataIsoValida(iso)) return "-";
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

function obterMesAno(iso) {
  const [ano, mes] = String(iso || "").split("-");
  return { ano, mes };
}

function nomeMesAno(mesIso) {
  if (!mesIsoValido(mesIso)) return "mês atual";
  const [ano, mes] = mesIso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(ano, mes - 1, 1));
}

function somarMeses(mesIso, quantidade) {
  const referencia = mesIsoValido(mesIso) ? mesIso : mesAtualIso();
  const [ano, mes] = referencia.split("-").map(Number);
  return mesAtualIso(new Date(ano, mes - 1 + quantidade, 1));
}

function normalizarNivel(nivel) {
  const numero = Number(nivel);
  return Object.prototype.hasOwnProperty.call(limitesPorNivel, numero) ? numero : 0;
}

function normalizarCargoAcesso(cargo) {
  return cargosPermitidos.includes(cargo) ? cargo : "usuario";
}

function normalizarStatus(status) {
  return statusPermitidos.includes(status) ? status : "pendente";
}

function mostrarMensagem(texto, tipo) {
  const alvoMensagem = mensagem || mensagemLogin;
  if (!alvoMensagem) return;
  alvoMensagem.textContent = texto;
  alvoMensagem.classList.remove("erro", "sucesso");
  if (tipo) alvoMensagem.classList.add(tipo);
}

function firebaseConfigurado() {
  const config = window.firebaseConfig || {};
  const serviceAuth = window.firebaseServiceAuth || {};
  return Boolean(
    window.firebase &&
    config.apiKey &&
    config.projectId &&
    serviceAuth.email &&
    serviceAuth.password &&
    !String(config.apiKey).includes("COLE_") &&
    !String(config.projectId).includes("SEU_PROJETO")
  );
}

function dadosFirebaseCarregados() {
  return estagiariosCarregados && agendamentosCarregados;
}

function docSemId(item) {
  const { id, ...dados } = item;
  return dados;
}

async function salvar(chave, dados) {
  if (!db) {
    mostrarMensagem("Configure o Firebase antes de salvar dados.", "erro");
    return false;
  }

  const colecao = chave === CHAVE_ESTAGIARIOS ? COLECAO_ESTAGIARIOS : COLECAO_AGENDAMENTOS;
  const estadoAtual = chave === CHAVE_ESTAGIARIOS ? estadoRemoto.estagiarios : estadoRemoto.agendamentos;
  const lista = dados.map((item) => ({ ...item, id: String(item.id || gerarId()) }));

  if (chave === CHAVE_ESTAGIARIOS) {
    estadoRemoto.estagiarios = lista;
  } else {
    estadoRemoto.agendamentos = lista;
  }

  const batch = db.batch();
  const idsNovos = new Set(lista.map((item) => item.id));

  lista.forEach((item) => {
    batch.set(db.collection(colecao).doc(item.id), docSemId(item));
  });

  estadoAtual.forEach((item) => {
    if (!idsNovos.has(item.id)) {
      batch.delete(db.collection(colecao).doc(item.id));
    }
  });

  await batch.commit();
  return true;
}

async function iniciarFirebase() {
  if (!firebaseConfigurado()) {
    erroFirebase = "Firebase não configurado. Preencha firebase-config.js com os dados do projeto e a conta técnica em firebaseServiceAuth (email/senha).";
    estagiariosCarregados = true;
    agendamentosCarregados = true;
    renderizarTudo();
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();
    const serviceAuth = window.firebaseServiceAuth || {};
    await auth.signInWithEmailAndPassword(serviceAuth.email, serviceAuth.password);

    unsubscribeEstagiarios = db.collection(COLECAO_ESTAGIARIOS).onSnapshot((snapshot) => {
      estadoRemoto.estagiarios = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      estagiariosCarregados = true;
      migrarPinsAusentes();
      garantirUsuarioBootstrap();
      renderizarTudo();
    }, (error) => {
      erroFirebase = `Erro ao carregar usuários: ${error.message}`;
      mostrarMensagem(erroFirebase, "erro");
    });

    unsubscribeAgendamentos = db.collection(COLECAO_AGENDAMENTOS).onSnapshot((snapshot) => {
      estadoRemoto.agendamentos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      agendamentosCarregados = true;
      renderizarTudo();
    }, (error) => {
      erroFirebase = `Erro ao carregar agendamentos: ${error.message}`;
      mostrarMensagem(erroFirebase, "erro");
    });
  } catch (error) {
    if (error && (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password")) {
      erroFirebase = "Erro ao iniciar Firebase: credenciais inválidas em firebaseServiceAuth. Configure um usuário Email/Senha válido no Firebase Authentication.";
    } else if (error && error.code === "auth/operation-not-allowed") {
      erroFirebase = "Erro ao iniciar Firebase: ative o método Email/Senha em Authentication > Sign-in method no Firebase Console.";
    } else {
      erroFirebase = `Erro ao iniciar Firebase: ${error.message}`;
    }
    estagiariosCarregados = true;
    agendamentosCarregados = true;
    renderizarTudo();
  }
}

async function migrarPinsAusentes() {
  if (!db || migracaoPinsEmAndamento) return;
  const semPin = estadoRemoto.estagiarios.filter((e) => !e.senhaHash);
  if (semPin.length === 0) return;

  migracaoPinsEmAndamento = true;
  try {
    const senhaHash = await hashPin("0000");
    const batch = db.batch();
    semPin.forEach((usuario) => {
      batch.update(db.collection(COLECAO_ESTAGIARIOS).doc(usuario.id), { senhaHash });
    });
    await batch.commit();
  } catch (error) {
    mostrarMensagem(`Erro ao migrar PINs: ${error.message}`, "erro");
  } finally {
    migracaoPinsEmAndamento = false;
  }
}

async function garantirUsuarioBootstrap() {
  if (!db || bootstrapUsuarioEmAndamento || !estagiariosCarregados) return;
  const estagiarios = normalizarEstagiarios(estadoRemoto.estagiarios);
  if (estagiarios.length > 0) return;

  bootstrapUsuarioEmAndamento = true;
  try {
    const emailServico = (window.firebaseServiceAuth && window.firebaseServiceAuth.email) || "";
    const nomeBase = emailServico ? emailServico.split("@")[0].replace(/[._-]+/g, " ") : "Administrador inicial";
    const nome = nomeBase
      .split(" ")
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

    const usuarioInicial = {
      id: gerarId(),
      nome: nome || "Administrador Inicial",
      cargoFuncional: "Gestor da plataforma",
      unidadeLotacao: "Matriz",
      nivel: 3,
      cargoAcesso: "master",
      senhaHash: await hashPin("0000"),
    };

    const salvo = await salvar(CHAVE_ESTAGIARIOS, [usuarioInicial]);
    if (!salvo) {
      mostrarMensagem("Falha ao criar usuário inicial automaticamente.", "erro");
    } else {
      mostrarMensagem("Usuário inicial criado. Use PIN 0000 para entrar e altere depois.", "sucesso");
    }
  } catch (error) {
    mostrarMensagem(`Erro ao criar usuário inicial: ${error.message}`, "erro");
  } finally {
    bootstrapUsuarioEmAndamento = false;
  }
}

function temaSistemaEhEscuro() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function aplicarTema(tema) {
  let temaFinal = tema;
  if (!["claro", "escuro", "sistema"].includes(temaFinal)) {
    temaFinal = "sistema";
  }

  if (seletorTema) {
    seletorTema.value = temaFinal;
  }

  const temaAplicado = temaFinal === "sistema" ? (temaSistemaEhEscuro() ? "escuro" : "claro") : temaFinal;
  document.documentElement.setAttribute("data-theme", temaAplicado);
}

function iniciarTema() {
  const temaSalvo = sessionStorage.getItem(CHAVE_TEMA) || "sistema";
  aplicarTema(temaSalvo);

  if (seletorTema) {
    seletorTema.addEventListener("change", () => {
      const temaEscolhido = seletorTema.value;
      sessionStorage.setItem(CHAVE_TEMA, temaEscolhido);
      aplicarTema(temaEscolhido);
    });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const temaSalvoAtual = sessionStorage.getItem(CHAVE_TEMA) || "sistema";
      if (temaSalvoAtual === "sistema") aplicarTema("sistema");
    });
  }
}

function normalizarEstagiarios(estagiariosRecebidos) {
  const base = Array.isArray(estagiariosRecebidos) ? estagiariosRecebidos : [];
  let alterou = !Array.isArray(estagiariosRecebidos);
  const ids = new Set();

  const normalizados = base.map((estagiario, indice) => {
    const item = estagiario && typeof estagiario === "object" ? { ...estagiario } : {};
    let id = String(item.id || gerarId());
    while (ids.has(id)) {
      id = gerarId();
      alterou = true;
    }
    ids.add(id);

    const nome = String(item.nome || `Usuário ${indice + 1}`).trim() || `Usuário ${indice + 1}`;
    const cargoAntigo = item.cargo && !cargosPermitidos.includes(item.cargo) ? item.cargo : "";
    const cargoFuncional = String(item.cargoFuncional || cargoAntigo || "Não informado").trim() || "Não informado";
    const unidadeLotacao = String(item.unidadeLotacao || "Não informada").trim() || "Não informada";
    const nivel = normalizarNivel(item.nivel);
    const cargoAcesso = normalizarCargoAcesso(item.cargoAcesso || item.cargo);
    const senhaHash = String(item.senhaHash || "");

    if (
      id !== item.id ||
      nome !== item.nome ||
      cargoFuncional !== item.cargoFuncional ||
      unidadeLotacao !== item.unidadeLotacao ||
      nivel !== item.nivel ||
      cargoAcesso !== item.cargoAcesso ||
      senhaHash !== item.senhaHash
    ) {
      alterou = true;
    }

    return { id, nome, cargoFuncional, unidadeLotacao, nivel, cargoAcesso, senhaHash };
  });

  if (normalizados.length > 0 && !normalizados.some((e) => e.cargoAcesso === "master")) {
    normalizados[0].cargoAcesso = "master";
  }

  return normalizados;
}

function normalizarAgendamentos(agendamentosRecebidos) {
  const base = Array.isArray(agendamentosRecebidos) ? agendamentosRecebidos : [];
  let alterou = !Array.isArray(agendamentosRecebidos);
  const ids = new Set();
  const normalizados = [];

  base.forEach((agendamento) => {
    const item = agendamento && typeof agendamento === "object" ? { ...agendamento } : {};
    if (!item.estagiarioId || !dataIsoValida(item.data)) {
      alterou = true;
      return;
    }

    let id = String(item.id || gerarId());
    while (ids.has(id)) {
      id = gerarId();
      alterou = true;
    }
    ids.add(id);

    const normalizado = {
      id,
      estagiarioId: String(item.estagiarioId),
      data: item.data,
      status: normalizarStatus(item.status),
      criadoEm: item.criadoEm || null,
      analisadoPor: item.analisadoPor || null,
      analisadoEm: item.analisadoEm || null,
    };

    if (
      id !== item.id ||
      normalizado.status !== item.status ||
      normalizado.estagiarioId !== item.estagiarioId ||
      normalizado.criadoEm !== item.criadoEm ||
      normalizado.analisadoEm !== item.analisadoEm
    ) {
      alterou = true;
    }

    normalizados.push(normalizado);
  });

  return normalizados;
}

function inicializarBase() {
  iniciarFirebase();
}

function getEstagiarios() {
  return normalizarEstagiarios(estadoRemoto.estagiarios);
}

function getAgendamentos() {
  return normalizarAgendamentos(estadoRemoto.agendamentos);
}

function obterUsuarioAtual(estagiarios) {
  const bruto = sessionStorage.getItem(CHAVE_USUARIO_ATUAL);
  if (!bruto) return null;

  let idAtual = bruto;
  try {
    idAtual = JSON.parse(bruto);
  } catch {
    idAtual = bruto;
  }

  return estagiarios.find((e) => e.id === String(idAtual)) || null;
}

function preencherUsuariosLogin(estagiarios, usuarioAtual) {
  if (!selectUsuarioLoginInicial) return;

  if (estagiarios.length === 0) {
    selectUsuarioLoginInicial.innerHTML = '<option value="">Cadastre o primeiro usuário abaixo</option>';
    return;
  }

  selectUsuarioLoginInicial.innerHTML = estagiarios
    .map((e) => {
      const selected = usuarioAtual && usuarioAtual.id === e.id ? "selected" : "";
      const nome = escaparHtml(e.nome);
      const cargo = escaparHtml(e.cargoAcesso || "usuario");
      return `<option value="${escaparAttr(e.id)}" ${selected}>${nome} (${cargo})</option>`;
    })
    .join("");
}

function contarUsoMensal(estagiarioId, dataIso, agendamentos, incluirPendentes) {
  const { ano, mes } = obterMesAno(dataIso);
  return agendamentos.filter((item) => {
    if (item.estagiarioId !== estagiarioId) return false;
    const referencia = obterMesAno(item.data);
    if (referencia.ano !== ano || referencia.mes !== mes) return false;
    return incluirPendentes ? statusAtivosNaCota.includes(item.status) : item.status === "aprovado";
  }).length;
}

function podeGerenciarAprovacoes(usuarioAtual) {
  return usuarioAtual && (usuarioAtual.cargoAcesso === "adm" || usuarioAtual.cargoAcesso === "master");
}

function podeVerTodos(usuarioAtual) {
  return podeGerenciarAprovacoes(usuarioAtual);
}

function podeCancelarAgendamento(agendamento, usuarioAtual) {
  if (!usuarioAtual || !["pendente", "aprovado"].includes(agendamento.status)) return false;
  if (agendamento.estagiarioId === usuarioAtual.id) return true;
  return agendamento.status === "pendente" && podeGerenciarAprovacoes(usuarioAtual);
}

function renderizarContextoAcesso(usuarioAtual) {
  if (!usuarioAtualEl) return;
  if (!usuarioAtual) {
    usuarioAtualEl.textContent = "Nenhum usuário logado.";
    return;
  }

  usuarioAtualEl.innerHTML = `Usuário atual: <span class="status-usuario">${escaparHtml(usuarioAtual.nome)}</span> (${escaparHtml(usuarioAtual.cargoAcesso)})`;
}

function filtrarEstagiarios(estagiarios, usuarioAtual) {
  const base = podeVerTodos(usuarioAtual)
    ? estagiarios
    : estagiarios.filter((e) => usuarioAtual && e.id === usuarioAtual.id);

  if (!filtros.busca) return base;
  const busca = normalizarTexto(filtros.busca);
  return base.filter((e) => {
    const alvo = normalizarTexto(`${e.nome} ${e.cargoFuncional} ${e.unidadeLotacao} ${e.cargoAcesso}`);
    return alvo.includes(busca);
  });
}

function filtrarAgendamentos(estagiarios, agendamentos, usuarioAtual) {
  const porId = Object.fromEntries(estagiarios.map((e) => [e.id, e]));
  const statusFiltro = statusPermitidos.includes(filtros.status) ? filtros.status : "";

  return agendamentos.filter((a) => {
    if (!podeVerTodos(usuarioAtual) && (!usuarioAtual || a.estagiarioId !== usuarioAtual.id)) return false;

    const estagiario = porId[a.estagiarioId];
    const nome = estagiario ? estagiario.nome : "";
    const cargo = estagiario ? estagiario.cargoFuncional : "";
    const unidade = estagiario ? estagiario.unidadeLotacao : "";

    if (filtros.busca) {
      const alvo = normalizarTexto(`${nome} ${cargo} ${unidade}`);
      if (!alvo.includes(normalizarTexto(filtros.busca))) return false;
    }

    if (statusFiltro && a.status !== statusFiltro) return false;

    if (mesIsoValido(filtros.mes)) {
      const [anoFiltro, mesFiltro] = filtros.mes.split("-");
      const { ano, mes } = obterMesAno(a.data);
      if (ano !== anoFiltro || mes !== mesFiltro) return false;
    }

    return true;
  });
}

function definirTexto(el, texto) {
  if (el) el.textContent = texto;
}

function renderizarSaldo(usuarioAtual, agendamentos) {
  if (!cardSaldo || !usuarioAtual) return;

  const hoje = dataHojeIso();
  const limite = limitesPorNivel[usuarioAtual.nivel] ?? 0;
  const aprovados = contarUsoMensal(usuarioAtual.id, hoje, agendamentos, false);
  const reservados = contarUsoMensal(usuarioAtual.id, hoje, agendamentos, true);
  const pendentes = Math.max(0, reservados - aprovados);
  const disponiveis = Math.max(0, limite - reservados);
  const percentual = limite === 0 ? 0 : Math.min(100, Math.round((reservados / limite) * 100));

  cardSaldo.innerHTML = `
    <div class="saldo-header">
      <div class="section-heading">
        <h2>Meu saldo mensal</h2>
        <p>Nível ${escaparHtml(usuarioAtual.nivel)} libera ${escaparHtml(limite)} home office${limite === 1 ? "" : "s"} por mês. Solicitações pendentes já reservam cota.</p>
      </div>
      <span class="badge ${disponiveis > 0 ? "aprovado" : "pendente"}">${disponiveis} disponível${disponiveis === 1 ? "" : "is"}</span>
    </div>
    <div class="saldo-metricas">
      <div class="saldo-item">
        <span>Cota mensal</span>
        <strong>${limite}</strong>
      </div>
      <div class="saldo-item">
        <span>Aprovados</span>
        <strong>${aprovados}</strong>
      </div>
      <div class="saldo-item">
        <span>Pendentes</span>
        <strong>${pendentes}</strong>
      </div>
      <div class="saldo-item">
        <span>Disponíveis</span>
        <strong>${disponiveis}</strong>
      </div>
    </div>
    <div class="progress" aria-label="Uso da cota mensal">
      <span style="--valor: ${percentual}%"></span>
    </div>
  `;
}

function renderizarCadastroUsuario(usuarioAtual) {
  if (!cardCadastroUsuario) return;
  cardCadastroUsuario.style.display = usuarioAtual && usuarioAtual.cargoAcesso === "master" ? "block" : "none";
}

function atualizarKpis(estagiarios, agendamentos, usuarioAtual) {
  const hoje = dataHojeIso();
  const { ano, mes } = obterMesAno(hoje);

  if (!podeVerTodos(usuarioAtual)) {
    const meusAgendamentos = agendamentos.filter((a) => usuarioAtual && a.estagiarioId === usuarioAtual.id);
    const limite = usuarioAtual ? limitesPorNivel[usuarioAtual.nivel] ?? 0 : 0;
    const aprovadosNoMes = meusAgendamentos.filter((a) => {
      const ref = obterMesAno(a.data);
      return a.status === "aprovado" && ref.ano === ano && ref.mes === mes;
    }).length;
    const pendentes = meusAgendamentos.filter((a) => a.status === "pendente").length;
    const reservados = usuarioAtual ? contarUsoMensal(usuarioAtual.id, hoje, agendamentos, true) : 0;
    const usoCota = limite === 0 ? "0%" : `${Math.min(100, Math.round((reservados / limite) * 100))}%`;

    definirTexto(labelKpiTotalUsuarios, "Minha cota mensal");
    definirTexto(labelKpiPendentes, "Minhas pendências");
    definirTexto(labelKpiAprovadosMes, "Meus aprovados no mês");
    definirTexto(labelKpiTaxaAprovacao, "Uso da cota");
    definirTexto(kpiTotalUsuarios, String(limite));
    definirTexto(kpiPendentes, String(pendentes));
    definirTexto(kpiAprovadosMes, String(aprovadosNoMes));
    definirTexto(kpiTaxaAprovacao, usoCota);
    return;
  }

  const pendentes = agendamentos.filter((a) => a.status === "pendente").length;
  const aprovadosNoMes = agendamentos.filter((a) => {
    if (a.status !== "aprovado") return false;
    const ref = obterMesAno(a.data);
    return ref.ano === ano && ref.mes === mes;
  }).length;
  const analisados = agendamentos.filter((a) => a.status === "aprovado" || a.status === "negado");
  const taxaAprovacao = analisados.length === 0
    ? 0
    : Math.round((analisados.filter((a) => a.status === "aprovado").length / analisados.length) * 100);

  definirTexto(labelKpiTotalUsuarios, "Total de usuários");
  definirTexto(labelKpiPendentes, "Solicitações pendentes");
  definirTexto(labelKpiAprovadosMes, "Aprovados no mês");
  definirTexto(labelKpiTaxaAprovacao, "Taxa de aprovação");
  definirTexto(kpiTotalUsuarios, String(estagiarios.length));
  definirTexto(kpiPendentes, String(pendentes));
  definirTexto(kpiAprovadosMes, String(aprovadosNoMes));
  definirTexto(kpiTaxaAprovacao, `${taxaAprovacao}%`);
}

function renderizarEstagiarios(estagiarios, agendamentos, usuarioAtual) {
  if (!tabelaEstagiarios) return;
  const lista = filtrarEstagiarios(estagiarios, usuarioAtual);

  if (lista.length === 0) {
    tabelaEstagiarios.innerHTML = `<tr><td colspan="9">Nenhum estagiário encontrado.</td></tr>`;
    return;
  }

  const hoje = dataHojeIso();
  const isMaster = usuarioAtual && usuarioAtual.cargoAcesso === "master";

  tabelaEstagiarios.innerHTML = lista
    .map((e) => {
      const aprovados = contarUsoMensal(e.id, hoje, agendamentos, false);
      const reservados = contarUsoMensal(e.id, hoje, agendamentos, true);
      const limite = limitesPorNivel[e.nivel] ?? 0;
      const nome = escaparHtml(e.nome);
      const id = escaparAttr(e.id);

      const nivelCelula = isMaster
        ? `
          <select data-nivel-id="${id}" aria-label="Nível de ${nome}">
            ${Object.keys(limitesPorNivel)
              .map((nivel) => `<option value="${nivel}" ${Number(nivel) === e.nivel ? "selected" : ""}>Nível ${nivel}</option>`)
              .join("")}
          </select>
        `
        : `<span class="badge">${escaparHtml(`nível ${e.nivel}`)}</span>`;

      const perfilCelula = isMaster
        ? `
          <select data-cargo-id="${id}" aria-label="Perfil de ${nome}">
            ${cargosPermitidos
              .map((cargo) => `<option value="${cargo}" ${cargo === (e.cargoAcesso || "usuario") ? "selected" : ""}>${cargo}</option>`)
              .join("")}
          </select>
        `
        : escaparHtml(e.cargoAcesso || "usuario");

      const acoes = isMaster
        ? `
          <div class="acoes">
            <button class="btn-secundario" data-acao="salvar-usuario" data-id="${id}" type="button">Salvar</button>
            <button class="btn-negado" data-acao="excluir-usuario" data-id="${id}" type="button">Excluir</button>
          </div>
        `
        : "-";
      const senhaCelula = isMaster
        ? `<input class="pin-input" data-pin-id="${id}" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="Novo PIN" aria-label="Nova senha de 4 dígitos para ${nome}">`
        : `<span class="badge ${e.senhaHash ? "aprovado" : "pendente"}">${e.senhaHash ? "definida" : "pendente"}</span>`;

      return `
        <tr>
          <td>${nome}</td>
          <td>${escaparHtml(e.cargoFuncional || "-")}</td>
          <td>${escaparHtml(e.unidadeLotacao || "-")}</td>
          <td class="nowrap">${nivelCelula}</td>
          <td class="nowrap">${perfilCelula}</td>
          <td>${limite}</td>
          <td>${aprovados}${reservados > aprovados ? ` (${reservados} reservados)` : ""}</td>
          <td>${senhaCelula}</td>
          <td>${acoes}</td>
        </tr>
      `;
    })
    .join("");
}

function renderizarAgendamentos(estagiarios, agendamentos, usuarioAtual) {
  if (!tabelaAgendamentos) return;
  const listaFiltrada = filtrarAgendamentos(estagiarios, agendamentos, usuarioAtual);

  if (listaFiltrada.length === 0) {
    tabelaAgendamentos.innerHTML = `<tr><td colspan="6">Nenhum agendamento encontrado.</td></tr>`;
    return;
  }

  const porId = Object.fromEntries(estagiarios.map((e) => [e.id, e]));
  const listaOrdenada = [...listaFiltrada].sort((a, b) => a.data.localeCompare(b.data));

  tabelaAgendamentos.innerHTML = listaOrdenada
    .map((a) => {
      const estagiario = porId[a.estagiarioId];
      const nivel = estagiario ? estagiario.nivel : "-";
      const nome = estagiario ? estagiario.nome : "Estagiário removido";
      const podeCancelar = podeCancelarAgendamento(a, usuarioAtual);
      const acao = podeCancelar
        ? `<button class="btn-secundario" data-acao="cancelar-agendamento" data-id="${escaparAttr(a.id)}" type="button">Cancelar</button>`
        : "-";

      return `
        <tr>
          <td>${formatarData(a.data)}</td>
          <td>${escaparHtml(nome)}</td>
          <td>${escaparHtml(nivel)}</td>
          <td>${mesAnoDaData(a.data)}</td>
          <td><span class="badge ${escaparAttr(a.status)}">${escaparHtml(a.status)}</span></td>
          <td>${acao}</td>
        </tr>
      `;
    })
    .join("");
}

function renderizarPendentes(estagiarios, agendamentos, usuarioAtual) {
  if (!cardAprovacoes || !tabelaPendentes) return;
  if (!podeGerenciarAprovacoes(usuarioAtual)) {
    cardAprovacoes.style.display = "none";
    return;
  }

  cardAprovacoes.style.display = "block";
  const porId = Object.fromEntries(estagiarios.map((e) => [e.id, e]));
  const pendentes = agendamentos
    .filter((a) => a.status === "pendente")
    .sort((a, b) => a.data.localeCompare(b.data));
  aprovacoesPendentesParaExportacao = pendentes;

  if (pendentes.length === 0) {
    tabelaPendentes.innerHTML = `<tr><td colspan="5">Sem solicitações pendentes.</td></tr>`;
    return;
  }

  tabelaPendentes.innerHTML = pendentes
    .map((a) => {
      const estagiario = porId[a.estagiarioId];
      const nome = estagiario ? estagiario.nome : "Desconhecido";
      const nivel = estagiario ? estagiario.nivel : "-";
      return `
        <tr>
          <td>${formatarData(a.data)}</td>
          <td>${escaparHtml(nome)}</td>
          <td>${escaparHtml(nivel)}</td>
          <td><span class="badge pendente">pendente</span></td>
          <td class="acoes">
            <button class="btn-secundario" data-acao="aprovar" data-id="${escaparAttr(a.id)}" type="button">Aprovar</button>
            <button class="btn-negado" data-acao="negar" data-id="${escaparAttr(a.id)}" type="button">Negar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderizarCalendario(estagiarios, agendamentos, usuarioAtual) {
  if (!calendarioMes) return;

  const mesReferencia = mesIsoValido(filtros.mes) ? filtros.mes : mesAtualIso();
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const primeiroDia = new Date(ano, mes - 1, 1);
  const totalDias = new Date(ano, mes, 0).getDate();
  const deslocamento = primeiroDia.getDay();
  const porId = Object.fromEntries(estagiarios.map((e) => [e.id, e]));
  const eventos = filtrarAgendamentos(estagiarios, agendamentos, usuarioAtual).filter((a) => {
    const ref = obterMesAno(a.data);
    return ref.ano === String(ano) && ref.mes === String(mes).padStart(2, "0");
  });

  const eventosPorData = eventos.reduce((mapa, item) => {
    const lista = mapa.get(item.data) || [];
    lista.push(item);
    mapa.set(item.data, lista);
    return mapa;
  }, new Map());

  const hoje = dataHojeIso();
  const cabecalho = diasSemana.map((dia) => `<div class="calendar-weekday">${dia}</div>`).join("");
  const vazios = Array.from({ length: deslocamento }, () => '<div class="calendar-empty" aria-hidden="true"></div>').join("");
  const dias = Array.from({ length: totalDias }, (_, indice) => {
    const dia = indice + 1;
    const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const eventosDoDia = (eventosPorData.get(iso) || []).sort((a, b) => a.status.localeCompare(b.status));
    const classes = ["calendar-day"];
    if (iso === hoje) classes.push("hoje");
    const estaNoPassado = iso < hoje;
    const ehFimDeSemana = dataEhFimDeSemana(iso);
    if (estaNoPassado || ehFimDeSemana) classes.push("indisponivel");
    const rotuloDia = estaNoPassado
      ? `Data passada: ${formatarData(iso)}`
      : ehFimDeSemana
        ? `Fim de semana: ${formatarData(iso)}`
        : `Agendar home office em ${formatarData(iso)}`;

    const itens = eventosDoDia.slice(0, 3).map((evento) => {
      const estagiario = porId[evento.estagiarioId];
      const nome = estagiario ? estagiario.nome : "Removido";
      return `<span class="calendar-event ${escaparAttr(evento.status)}" title="${escaparAttr(`${nome} - ${evento.status}`)}">${escaparHtml(nome)}</span>`;
    }).join("");
    const restantes = eventosDoDia.length > 3 ? `<span class="calendar-count">+${eventosDoDia.length - 3}</span>` : "";

    return `
      <div class="${classes.join(" ")}" data-calendario-data="${iso}" role="button" tabindex="0" aria-label="${escaparAttr(rotuloDia)}" title="${escaparAttr(rotuloDia)}">
        <div class="calendar-date">
          <span>${dia}</span>
          <span class="calendar-count">${eventosDoDia.length || ""}</span>
        </div>
        <div class="calendar-events">${itens}${restantes}</div>
      </div>
    `;
  }).join("");

  calendarioMes.innerHTML = `${cabecalho}${vazios}${dias}`;
  if (legendaCalendario) {
    legendaCalendario.textContent = `${eventos.length} agendamento${eventos.length === 1 ? "" : "s"} em ${nomeMesAno(mesReferencia)}.`;
  }
}

function configurarCampoDataHome() {
  if (!dataHomeInput) return;
  dataHomeInput.min = dataHojeIso();
}

function iniciarFiltrosPadrao() {
  if (!filtroMes || !estaNaPaginaApp) return;
  filtroMes.value = mesAtualIso();
  filtros.mes = filtroMes.value;
}

function renderizarTudo() {
  if (erroFirebase) {
    preencherUsuariosLogin([], null);
    renderizarContextoAcesso(null);
    mostrarMensagem(erroFirebase, "erro");
    return;
  }

  if (!dadosFirebaseCarregados()) {
    preencherUsuariosLogin([], null);
    renderizarContextoAcesso(null);
    mostrarMensagem("Conectando ao Firebase...", null);
    return;
  }

  const estagiarios = getEstagiarios();
  const agendamentos = getAgendamentos();
  const usuarioAtual = obterUsuarioAtual(estagiarios);

  preencherUsuariosLogin(estagiarios, usuarioAtual);
  if (estaNaPaginaLogin && usuarioAtual) {
    window.location.href = "app.html";
    return;
  }
  if (estaNaPaginaApp && !usuarioAtual) {
    window.location.href = "index.html";
    return;
  }

  configurarCampoDataHome();
  renderizarContextoAcesso(usuarioAtual);
  if (!usuarioAtual) return;

  renderizarSaldo(usuarioAtual, agendamentos);
  renderizarCadastroUsuario(usuarioAtual);
  atualizarKpis(estagiarios, agendamentos, usuarioAtual);
  renderizarEstagiarios(estagiarios, agendamentos, usuarioAtual);
  renderizarPendentes(estagiarios, agendamentos, usuarioAtual);
  renderizarCalendario(estagiarios, agendamentos, usuarioAtual);
  renderizarAgendamentos(estagiarios, agendamentos, usuarioAtual);
}

if (formLoginInicial) {
  formLoginInicial.addEventListener("submit", async (event) => {
    event.preventDefault();
    const usuarioId = selectUsuarioLoginInicial.value;
    const pin = senhaLoginInicial ? senhaLoginInicial.value.trim() : "";
    if (!usuarioId) {
      mostrarMensagem("Cadastre o primeiro usuário para começar.", "erro");
      return;
    }
    if (!pinValido(pin)) {
      mostrarMensagem("Informe a senha de 4 dígitos.", "erro");
      return;
    }

    const usuario = getEstagiarios().find((e) => e.id === usuarioId);
    if (!usuario || !usuario.senhaHash) {
      mostrarMensagem("Usuário sem senha definida. Peça para master redefinir o PIN.", "erro");
      return;
    }

    const senhaHash = await hashPin(pin);
    if (senhaHash !== usuario.senhaHash) {
      mostrarMensagem("Senha inválida.", "erro");
      return;
    }

    sessionStorage.setItem(CHAVE_USUARIO_ATUAL, usuarioId);
    renderizarTudo();
  });
}

if (formAutoCadastro) {
  formAutoCadastro.addEventListener("submit", async (event) => {
    event.preventDefault();
    const estagiarios = getEstagiarios();
    const nome = document.getElementById("cadastro-nome").value.trim();
    const cargoFuncional = document.getElementById("cadastro-cargo").value.trim();
    const unidadeLotacao = document.getElementById("cadastro-unidade").value.trim();
    const nivel = Number(document.getElementById("cadastro-nivel").value);
    const pin = document.getElementById("cadastro-senha").value.trim();

    if (!nome) return mostrarMensagem("Informe o nome completo.", "erro");
    if (!cargoFuncional) return mostrarMensagem("Informe o cargo.", "erro");
    if (!unidadeLotacao) return mostrarMensagem("Informe a unidade de lotação.", "erro");
    if (!pinValido(pin)) return mostrarMensagem("Crie uma senha de exatamente 4 dígitos.", "erro");

    const nomeJaExiste = estagiarios.some((e) => normalizarTexto(e.nome) === normalizarTexto(nome));
    if (nomeJaExiste) return mostrarMensagem("Já existe um usuário com esse nome. Faça login.", "erro");

    const primeiroCadastro = estagiarios.length === 0;
    const novoUsuario = {
      id: gerarId(),
      nome,
      cargoFuncional,
      unidadeLotacao,
      nivel: normalizarNivel(nivel),
      cargoAcesso: primeiroCadastro ? "master" : "usuario",
      senhaHash: await hashPin(pin),
    };

    estagiarios.push(novoUsuario);
    const salvo = await salvar(CHAVE_ESTAGIARIOS, estagiarios);
    if (!salvo) {
      mostrarMensagem("Não foi possível criar a conta agora. Verifique regras/conexão do Firebase.", "erro");
      return;
    }
    sessionStorage.setItem(CHAVE_USUARIO_ATUAL, novoUsuario.id);
    window.location.href = "app.html";
  });
}

if (formCadastroUsuario) {
  formCadastroUsuario.addEventListener("submit", async (event) => {
    event.preventDefault();
    const estagiarios = getEstagiarios();
    const usuarioAtual = obterUsuarioAtual(estagiarios);
    if (!usuarioAtual || usuarioAtual.cargoAcesso !== "master") {
      mostrarMensagem("Apenas master pode cadastrar usuários pelo painel.", "erro");
      return;
    }

    const nome = document.getElementById("novo-usuario-nome").value.trim();
    const cargoFuncional = document.getElementById("novo-usuario-cargo").value.trim();
    const unidadeLotacao = document.getElementById("novo-usuario-unidade").value.trim();
    const nivel = Number(document.getElementById("novo-usuario-nivel").value);
    const cargoAcesso = document.getElementById("novo-usuario-perfil").value;
    const pin = document.getElementById("novo-usuario-senha").value.trim();

    if (!nome) return mostrarMensagem("Informe o nome completo do novo usuário.", "erro");
    if (!cargoFuncional) return mostrarMensagem("Informe o cargo do novo usuário.", "erro");
    if (!unidadeLotacao) return mostrarMensagem("Informe a unidade do novo usuário.", "erro");
    if (!cargosPermitidos.includes(cargoAcesso)) return mostrarMensagem("Perfil de acesso inválido.", "erro");
    if (!pinValido(pin)) return mostrarMensagem("Defina uma senha de exatamente 4 dígitos.", "erro");

    const nomeJaExiste = estagiarios.some((e) => normalizarTexto(e.nome) === normalizarTexto(nome));
    if (nomeJaExiste) return mostrarMensagem("Já existe um usuário com esse nome.", "erro");

    estagiarios.push({
      id: gerarId(),
      nome,
      cargoFuncional,
      unidadeLotacao,
      nivel: normalizarNivel(nivel),
      cargoAcesso,
      senhaHash: await hashPin(pin),
    });
    await salvar(CHAVE_ESTAGIARIOS, estagiarios);
    formCadastroUsuario.reset();
    mostrarMensagem("Usuário cadastrado com sucesso.", "sucesso");
    renderizarTudo();
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem(CHAVE_USUARIO_ATUAL);
    window.location.href = "index.html";
  });
}

if (formFiltros) {
  const atualizarFiltros = () => {
    filtros.busca = filtroBusca ? filtroBusca.value.trim() : "";
    filtros.status = filtroStatus ? filtroStatus.value : "";
    filtros.mes = filtroMes ? filtroMes.value : "";
    renderizarTudo();
  };
  formFiltros.addEventListener("input", atualizarFiltros);
  formFiltros.addEventListener("change", atualizarFiltros);
}

if (btnLimparFiltros) {
  btnLimparFiltros.addEventListener("click", () => {
    filtros.busca = "";
    filtros.status = "";
    filtros.mes = "";
    if (filtroBusca) filtroBusca.value = "";
    if (filtroStatus) filtroStatus.value = "";
    if (filtroMes) filtroMes.value = "";
    renderizarTudo();
  });
}

function definirMesDoCalendario(mesIso) {
  const mesFinal = mesIsoValido(mesIso) ? mesIso : mesAtualIso();
  filtros.mes = mesFinal;
  if (filtroMes) filtroMes.value = mesFinal;
  renderizarTudo();
}

if (btnMesAnterior) {
  btnMesAnterior.addEventListener("click", () => {
    definirMesDoCalendario(somarMeses(filtros.mes, -1));
  });
}

if (btnMesAtual) {
  btnMesAtual.addEventListener("click", () => {
    definirMesDoCalendario(mesAtualIso());
  });
}

if (btnMesProximo) {
  btnMesProximo.addEventListener("click", () => {
    definirMesDoCalendario(somarMeses(filtros.mes, 1));
  });
}

function campoCsv(valor) {
  const texto = String(valor ?? "");
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

async function solicitarHomeOffice(data, origem = "formulario") {
  if (!dataIsoValida(data)) return mostrarMensagem("Selecione uma data válida.", "erro");
  if (data < dataHojeIso()) return mostrarMensagem("Não é permitido solicitar home office em data passada.", "erro");
  if (dataEhFimDeSemana(data)) return mostrarMensagem("Solicitações só podem ser feitas para dias úteis.", "erro");

  const estagiarios = getEstagiarios();
  const agendamentos = getAgendamentos();
  const usuarioAtual = obterUsuarioAtual(estagiarios);
  if (!usuarioAtual) return mostrarMensagem("Faça login para solicitar.", "erro");

  const limite = limitesPorNivel[usuarioAtual.nivel] ?? 0;
  if (limite === 0) {
    return mostrarMensagem(`${usuarioAtual.nome} está no nível 0 e não possui direito a home office no mês.`, "erro");
  }

  const jaExisteMesmoDia = agendamentos.some((a) => (
    a.estagiarioId === usuarioAtual.id &&
    a.data === data &&
    statusAtivosNaCota.includes(a.status)
  ));
  if (jaExisteMesmoDia) return mostrarMensagem("Já existe solicitação ativa para essa data.", "erro");

  const usadosNoMes = contarUsoMensal(usuarioAtual.id, data, agendamentos, true);
  if (usadosNoMes >= limite) {
    return mostrarMensagem(`${usuarioAtual.nome} já atingiu o limite mensal de ${limite} solicitação(ões).`, "erro");
  }

  agendamentos.push({
    id: gerarId(),
    estagiarioId: usuarioAtual.id,
    data,
    status: "pendente",
    criadoEm: new Date().toISOString(),
    analisadoPor: null,
    analisadoEm: null,
  });
  await salvar(CHAVE_AGENDAMENTOS, agendamentos);
  if (formAgendamento) formAgendamento.reset();
  configurarCampoDataHome();
  const complemento = origem === "calendario" ? ` para ${formatarData(data)}` : "";
  mostrarMensagem(`Solicitação criada${complemento} e enviada para aprovação.`, "sucesso");
  renderizarTudo();
  return true;
}

if (btnExportarCsv) {
  btnExportarCsv.addEventListener("click", () => {
    const estagiarios = getEstagiarios();
    const porId = Object.fromEntries(estagiarios.map((e) => [e.id, e]));
    const linhas = [
      ["data", "estagiario", "cargo", "unidade", "nivel", "status", "criado_em"].join(","),
      ...aprovacoesPendentesParaExportacao.map((a) => {
        const e = porId[a.estagiarioId];
        const cols = [
          formatarData(a.data),
          e ? e.nome : "Estagiário removido",
          e ? e.cargoFuncional : "-",
          e ? e.unidadeLotacao : "-",
          e ? String(e.nivel) : "-",
          a.status,
          formatarDataHora(a.criadoEm),
        ];
        return cols.map(campoCsv).join(",");
      }),
    ];

    const blob = new Blob([`\uFEFF${linhas.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const hoje = dataHojeIso();
    link.href = url;
    link.download = `aprovacoes-pendentes-home-office-${hoje}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    mostrarMensagem("CSV de aprovações pendentes exportado com sucesso.", "sucesso");
  });
}

if (btnLimparAgendamentos) {
  btnLimparAgendamentos.addEventListener("click", async () => {
    const estagiarios = getEstagiarios();
    const usuarioAtual = obterUsuarioAtual(estagiarios);
    if (!usuarioAtual) return mostrarMensagem("Faça login para limpar o histórico.", "erro");

    const agendamentos = getAgendamentos();
    const podeLimparTodos = podeVerTodos(usuarioAtual);
    const removiveis = agendamentos.filter((a) => {
      const pertenceAoUsuario = a.estagiarioId === usuarioAtual.id;
      const estaNoEscopo = podeLimparTodos || pertenceAoUsuario;
      return estaNoEscopo && (a.status === "cancelado" || a.status === "negado");
    });

    if (removiveis.length === 0) {
      mostrarMensagem("Não há histórico cancelado ou negado para limpar.", "erro");
      return;
    }

    const confirmou = window.confirm(`Limpar ${removiveis.length} registro(s) cancelado(s)/negado(s) do histórico?`);
    if (!confirmou) return;

    const idsRemoviveis = new Set(removiveis.map((a) => a.id));
    await salvar(CHAVE_AGENDAMENTOS, agendamentos.filter((a) => !idsRemoviveis.has(a.id)));
    mostrarMensagem("Histórico de agendamentos limpo com sucesso.", "sucesso");
    renderizarTudo();
  });
}

if (formAgendamento) formAgendamento.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = dataHomeInput ? dataHomeInput.value : "";
  solicitarHomeOffice(data);
});

if (calendarioMes) {
  calendarioMes.addEventListener("click", (event) => {
    const alvo = event.target;
    if (!(alvo instanceof HTMLElement)) return;
    const dia = alvo.closest("[data-calendario-data]");
    if (!(dia instanceof HTMLElement)) return;
    const data = dia.dataset.calendarioData;
    if (dataHomeInput && dataIsoValida(data)) dataHomeInput.value = data;
    solicitarHomeOffice(data, "calendario");
  });

  calendarioMes.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const alvo = event.target;
    if (!(alvo instanceof HTMLElement)) return;
    const data = alvo.dataset.calendarioData;
    if (!data) return;
    event.preventDefault();
    if (dataHomeInput && dataIsoValida(data)) dataHomeInput.value = data;
    solicitarHomeOffice(data, "calendario");
  });
}

if (tabelaPendentes) tabelaPendentes.addEventListener("click", async (event) => {
  const alvo = event.target;
  if (!(alvo instanceof HTMLElement)) return;

  const acao = alvo.dataset.acao;
  if (!acao) return;

  const estagiarios = getEstagiarios();
  const agendamentos = getAgendamentos();
  const usuarioAtual = obterUsuarioAtual(estagiarios);
  if (!podeGerenciarAprovacoes(usuarioAtual)) {
    mostrarMensagem("Sem permissão para aprovar ou negar.", "erro");
    return;
  }

  const id = alvo.dataset.id;
  const idx = agendamentos.findIndex((a) => a.id === id);
  if (idx < 0) return;

  const item = agendamentos[idx];
  if (item.status !== "pendente") {
    mostrarMensagem("Esta solicitação já foi analisada.", "erro");
    return;
  }

  if (acao === "aprovar") {
    const estagiario = estagiarios.find((e) => e.id === item.estagiarioId);
    if (!estagiario) {
      mostrarMensagem("Estagiário não encontrado.", "erro");
      return;
    }

    if (item.data < dataHojeIso()) {
      mostrarMensagem("Não é possível aprovar uma solicitação de data passada.", "erro");
      return;
    }

    if (dataEhFimDeSemana(item.data)) {
      mostrarMensagem("Não é possível aprovar home office em fim de semana.", "erro");
      return;
    }

    const limite = limitesPorNivel[estagiario.nivel] ?? 0;
    const aprovadosNoMes = contarUsoMensal(estagiario.id, item.data, agendamentos, false);
    if (aprovadosNoMes >= limite) {
      mostrarMensagem(
        `Não foi possível aprovar: ${estagiario.nome} já atingiu o limite mensal atual.`,
        "erro"
      );
      return;
    }

    item.status = "aprovado";
    item.analisadoPor = usuarioAtual.id;
    item.analisadoEm = new Date().toISOString();
    mostrarMensagem("Solicitação aprovada.", "sucesso");
  }

  if (acao === "negar") {
    item.status = "negado";
    item.analisadoPor = usuarioAtual.id;
    item.analisadoEm = new Date().toISOString();
    mostrarMensagem("Solicitação negada.", "erro");
  }

  await salvar(CHAVE_AGENDAMENTOS, agendamentos);
  renderizarTudo();
});

if (tabelaAgendamentos) tabelaAgendamentos.addEventListener("click", async (event) => {
  const alvo = event.target;
  if (!(alvo instanceof HTMLElement)) return;

  const acao = alvo.dataset.acao;
  if (acao !== "cancelar-agendamento") return;

  const estagiarios = getEstagiarios();
  const agendamentos = getAgendamentos();
  const usuarioAtual = obterUsuarioAtual(estagiarios);
  const id = alvo.dataset.id;
  const item = agendamentos.find((a) => a.id === id);
  if (!item) return;

  if (!podeCancelarAgendamento(item, usuarioAtual)) {
    mostrarMensagem("Sem permissão para cancelar esta solicitação.", "erro");
    return;
  }

  item.status = "cancelado";
  item.analisadoPor = usuarioAtual.id;
  item.analisadoEm = new Date().toISOString();
  await salvar(CHAVE_AGENDAMENTOS, agendamentos);
  mostrarMensagem("Solicitação cancelada.", "sucesso");
  renderizarTudo();
});

function selecionarPorDataset(seletor, chaveDataset, id) {
  return [...document.querySelectorAll(seletor)].find((elemento) => elemento.dataset[chaveDataset] === id) || null;
}

if (tabelaEstagiarios) tabelaEstagiarios.addEventListener("click", async (event) => {
  const alvo = event.target;
  if (!(alvo instanceof HTMLElement)) return;

  const acao = alvo.dataset.acao;
  if (!acao) return;

  const estagiarios = getEstagiarios();
  const usuarioAtual = obterUsuarioAtual(estagiarios);
  if (!usuarioAtual || usuarioAtual.cargoAcesso !== "master") {
    mostrarMensagem("Apenas master pode alterar usuários.", "erro");
    return;
  }

  const idAlvo = alvo.dataset.id;
  const idx = estagiarios.findIndex((e) => e.id === idAlvo);
  if (idx < 0) return;

  if (acao === "salvar-usuario") {
    const selectCargo = selecionarPorDataset("select[data-cargo-id]", "cargoId", idAlvo);
    const selectNivel = selecionarPorDataset("select[data-nivel-id]", "nivelId", idAlvo);
    const inputPin = selecionarPorDataset("input[data-pin-id]", "pinId", idAlvo);
    if (!(selectCargo instanceof HTMLSelectElement) || !(selectNivel instanceof HTMLSelectElement)) return;

    const novoCargo = selectCargo.value;
    const novoNivel = normalizarNivel(selectNivel.value);
    const novoPin = inputPin instanceof HTMLInputElement ? inputPin.value.trim() : "";
    if (!cargosPermitidos.includes(novoCargo)) {
      mostrarMensagem("Perfil de acesso inválido.", "erro");
      return;
    }
    if (novoPin && !pinValido(novoPin)) {
      mostrarMensagem("O novo PIN precisa ter exatamente 4 dígitos.", "erro");
      return;
    }

    if ((estagiarios[idx].cargoAcesso || "usuario") === "master" && novoCargo !== "master") {
      const totalMasters = estagiarios.filter((e) => (e.cargoAcesso || "usuario") === "master").length;
      if (totalMasters <= 1) {
        mostrarMensagem("Não é possível remover o único master da plataforma.", "erro");
        return;
      }
    }

    estagiarios[idx].cargoAcesso = novoCargo;
    estagiarios[idx].nivel = novoNivel;
    if (novoPin) {
      estagiarios[idx].senhaHash = await hashPin(novoPin);
    }
    await salvar(CHAVE_ESTAGIARIOS, estagiarios);
    mostrarMensagem("Usuário atualizado com sucesso.", "sucesso");
    renderizarTudo();
    return;
  }

  if (acao === "excluir-usuario") {
    const usuarioAlvo = estagiarios[idx];
    const ehMaster = (usuarioAlvo.cargoAcesso || "usuario") === "master";
    if (ehMaster) {
      const totalMasters = estagiarios.filter((e) => (e.cargoAcesso || "usuario") === "master").length;
      if (totalMasters <= 1) {
        mostrarMensagem("Não é possível excluir o único master da plataforma.", "erro");
        return;
      }
    }

    const confirmou = window.confirm(`Excluir ${usuarioAlvo.nome} e todos os agendamentos vinculados?`);
    if (!confirmou) return;

    const estagiariosAtualizados = estagiarios.filter((e) => e.id !== idAlvo);
    await salvar(CHAVE_ESTAGIARIOS, estagiariosAtualizados);

    const agendamentos = getAgendamentos();
    const agendamentosAtualizados = agendamentos.filter((a) => a.estagiarioId !== idAlvo);
    await salvar(CHAVE_AGENDAMENTOS, agendamentosAtualizados);

    if (usuarioAtual.id === idAlvo) {
      sessionStorage.removeItem(CHAVE_USUARIO_ATUAL);
      window.location.href = "index.html";
      return;
    }

    mostrarMensagem("Usuário excluído com sucesso.", "sucesso");
    renderizarTudo();
  }
});

inicializarBase();
iniciarTema();
iniciarFiltrosPadrao();
configurarCampoDataHome();
renderizarTudo();
