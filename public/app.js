/* ==========================================================
   📱 PONTO DIGITAL - LÓGICA COMPLETA (Frontend)
   ========================================================== */

const API_URL = window.location.origin.includes("localhost")
  ? "http://localhost:3000"
  : window.location.origin;

let token = null;
let usuario = null;

// =============== ELEMENTOS DOM ===============
const loginCard = document.getElementById("login-card");
const email = document.getElementById("email");
const senha = document.getElementById("senha");
const btnLogin = document.getElementById("btn-login");
const msgLogin = document.getElementById("msg-login");

const appCard = document.getElementById("app-card");
const helloText = document.getElementById("hello-text");
const txtCategoria = document.getElementById("txt-categoria");
const txtDia = document.getElementById("txt-dia");
const txtHorPrev = document.getElementById("txt-horario-previsto");
const txtStatus = document.getElementById("txt-status-ponto");
const saldoInfo = document.getElementById("saldo-info");
const btnEntrada = document.getElementById("btn-entrada");
const btnSaida = document.getElementById("btn-saida");
const btnIntervalo = document.getElementById("btn-intervalo");
const btnSair = document.getElementById("btn-sair");
const feriasAlert = document.getElementById("ferias-alert");

const cardFerias = document.getElementById("card-ferias");
const btnFeriasToggle = document.getElementById("btn-ferias-toggle");
const btnSolicitarFerias = document.getElementById("btn-solicitar-ferias");
const tipoFerias = document.getElementById("tipo-ferias");
const dataFerias = document.getElementById("data-ferias");
const feriasInfo = document.getElementById("ferias-info");
const msgFerias = document.getElementById("msg-ferias");

const cardAcessoPainel = document.getElementById("card-acesso-painel");
const btnAbrirPainel = document.getElementById("btn-abrir-painel");
const painelRH = document.getElementById("painel-rh");
const btnVoltarApp = document.getElementById("btn-voltar-app");

const tabelaFuncionarios = document.getElementById("tabela-funcionarios");
const tabelaPontos = document.getElementById("tabela-pontos");
const tabelaFerias = document.getElementById("tabela-ferias");
const tabelaBanco = document.getElementById("tabela-banco");

// =============== MENSAGENS ===============
function showMsg(el, text, ok = true) {
  el.textContent = text;
  el.classList.remove("hidden");
  el.classList.toggle("msg-ok", ok);
  el.classList.toggle("msg-err", !ok);
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function showAlertaFerias(texto, critico = false) {
  if (!feriasAlert) return;
  if (!texto) {
    feriasAlert.classList.add("hidden");
    return;
  }
  feriasAlert.textContent = texto;
  feriasAlert.classList.remove("hidden");
  feriasAlert.classList.toggle("msg-err", critico);
  feriasAlert.classList.toggle("msg-ok", !critico);
}

// =============== LOGIN ===============
btnLogin.addEventListener("click", async () => {
  const dados = { email: email.value.trim(), senha: senha.value.trim() };
  if (!dados.email || !dados.senha)
    return showMsg(msgLogin, "Preencha todos os campos", false);

  try {
    const resp = await fetch(API_URL + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const data = await resp.json();
    if (!resp.ok) return showMsg(msgLogin, data.error || "Erro no login", false);

    token = data.token;
    usuario = data.usuario;
    loginCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    inicializarTela();
  } catch (err) {
    console.error(err);
    showMsg(msgLogin, "Erro de conexão com servidor", false);
  }
});

// =============== SAIR ===============
btnSair.addEventListener("click", () => {
  token = null;
  usuario = null;
  appCard.classList.add("hidden");
  painelRH.classList.add("hidden");
  loginCard.classList.remove("hidden");
});

// =============== INICIALIZAR TELA ===============
function inicializarTela() {
  if (!usuario) return;
  helloText.textContent = "Olá, " + usuario.nome.split(" ")[0];

  const hoje = new Date();
  txtDia.textContent = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

  if (usuario.categoria === "RH") {
    txtCategoria.textContent = "RH";
    txtCategoria.className = "pill pill-rh";
  } else if (usuario.categoria === "ADMIN") {
    txtCategoria.textContent = "Admin";
    txtCategoria.className = "pill pill-admin";
  } else {
    txtCategoria.textContent = "Vendedor (" + (usuario.turno === "MANHA" ? "manhã" : "tarde") + ")";
    txtCategoria.className = "pill pill-vend";
  }

  txtHorPrev.textContent =
    usuario.categoria === "RH"
      ? "Jornada: 09:00 às 18:00 (seg–sex)"
      : usuario.turno === "MANHA"
      ? "Jornada: 10:00 às 16:00 (seg–sáb)"
      : "Jornada: 16:00 às 22:00 (seg–sáb)";

  cardAcessoPainel.classList.toggle("hidden", !(usuario.categoria === "RH" || usuario.categoria === "ADMIN"));

  verificarAlertaFerias();
}

// =============== ALERTA AUTOMÁTICO DE FÉRIAS ===============
async function verificarAlertaFerias() {
  if (!token) return;
  try {
    const resp = await fetch(API_URL + "/ferias/info", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await resp.json();
    if (!resp.ok || !data.temDados) return;

    const status = data.statusFerias || "";
    if (status.startsWith("⚠️")) showAlertaFerias(status, true);
    else showAlertaFerias("", false);

    feriasInfo.textContent =
      `Admissão: ${data.dataAdmissao.split("-").reverse().join("/")} · ` +
      `Ciclos: ${data.ciclosCompletos} · ` +
      `Disponível: ${data.diasDisponiveis} dias · ` +
      `Próx. aquisitiva: ${data.proximaDataAquisitiva.split("-").reverse().join("/")} ` +
      `(${data.diasParaProxima} dias). ` +
      `${data.statusFerias}`;
  } catch (err) {
    console.error("Erro alerta férias:", err);
  }
}

// =============== REGISTRO DE PONTO ===============
btnEntrada.addEventListener("click", () => baterPonto("entrada"));
btnSaida.addEventListener("click", () => baterPonto("saida"));

async function baterPonto(tipo) {
  if (!token) return;
  try {
    const foto = await tirarFoto();
    const form = new FormData();
    form.append("foto", foto);
    form.append("tipo", tipo);

    const resp = await fetch(API_URL + "/ponto/registrar", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });

    const data = await resp.json();
    if (!resp.ok) return alert("Erro: " + (data.error || "Falha"));
    alert("✅ Ponto de " + tipo + " registrado!");
  } catch (err) {
    console.error(err);
    alert("Erro ao capturar foto ou enviar ponto");
  }
}

// ====== CAPTURA DE FOTO ======
async function tirarFoto() {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    } catch (e) {
      reject(e);
    }
  });
}

// =============== INTERVALO DE 15 MIN ===============
btnIntervalo.addEventListener("click", () => {
  alert("⏱️ Iniciando intervalo de 15 minutos...");
  setTimeout(() => alert("⏰ Intervalo encerrado! Retorne ao trabalho."), 15 * 60 * 1000);
});

// =============== FÉRIAS ===============
btnFeriasToggle.addEventListener("click", () => cardFerias.classList.toggle("hidden"));

btnSolicitarFerias.addEventListener("click", async () => {
  if (!token) return;
  const tipo = tipoFerias.value;
  const dataInicio = dataFerias.value;
  const dias = tipo === "30" ? 30 : 15;

  if (!dataInicio) return showMsg(msgFerias, "Informe a data de início", false);

  const resp = await fetch(API_URL + "/ferias/solicitar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ tipo, dataInicio, dias }),
  });
  const data = await resp.json();
  if (!resp.ok) return showMsg(msgFerias, data.error || "Erro", false);
  showMsg(msgFerias, "Solicitação enviada!", true);
});

// =============== PAINEL RH ===============
btnAbrirPainel.addEventListener("click", () => {
  appCard.classList.add("hidden");
  painelRH.classList.remove("hidden");
  carregarPainelRH();
});

btnVoltarApp.addEventListener("click", () => {
  painelRH.classList.add("hidden");
  appCard.classList.remove("hidden");
});

// ======= Troca de abas =======
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ======= Carregar dados do painel RH =======
async function carregarPainelRH() {
  carregarFuncionarios();
  carregarBancoHoras();
  carregarFeriasPendentes();
}

// FUNCIONÁRIOS
async function carregarFuncionarios() {
  const resp = await fetch(API_URL + "/admin/funcionarios", {
    headers: { Authorization: "Bearer " + token },
  });
  const lista = await resp.json();
  tabelaFuncionarios.innerHTML = "";
  lista.forEach((f) => {
    let cor = "green";
    if (f.statusFerias.startsWith("⚠️ Vencidas")) cor = "red";
    else if (f.statusFerias.startsWith("⚠️ Vencem")) cor = "orange";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="status-dot" style="background:${cor}" title="${f.statusFerias}"></span>${f.nome}</td>
      <td>${f.categoria}</td>
      <td>${f.turno || "-"}</td>
      <td>${f.dataAdmissao || "-"}</td>
    `;
    tabelaFuncionarios.appendChild(tr);
  });
}

// BANCO DE HORAS
async function carregarBancoHoras() {
  const resp = await fetch(API_URL + "/admin/banco-horas", {
    headers: { Authorization: "Bearer " + token },
  });
  const lista = await resp.json();
  tabelaBanco.innerHTML = "";
  lista.forEach((r) => {
    const tr = document.createElement("tr");
    const sinal = r.saldoMin >= 0 ? "+" : "-";
    tr.innerHTML = `<td>${r.nome}</td><td>${r.categoria}</td><td>${sinal}${Math.abs(r.saldoMin)} min</td>`;
    tabelaBanco.appendChild(tr);
  });
}

// FÉRIAS PENDENTES (só visual)
async function carregarFeriasPendentes() {
  const resp = await fetch(API_URL + "/admin/ferias/pendentes", {
    headers: { Authorization: "Bearer " + token },
  });
  if (!resp.ok) return;
  const lista = await resp.json();
  tabelaFerias.innerHTML = "";
  lista.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.dataInicio}</td>
      <td>${f.dataFim}</td>
      <td>${f.dias}</td>
      <td>${f.status}</td>
      <td>${f.aviso}</td>
    `;
    tabelaFerias.appendChild(tr);
  });
}
