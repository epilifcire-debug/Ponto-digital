// ============================================================
// 🕒 PONTO DIGITAL - APP.JS COMPLETO (CRUD + FÉRIAS + STATUS)
// ============================================================

const API_URL = window.location.origin;
let token = null;
let usuarioAtual = null;

// ======= SELETORES PRINCIPAIS =======
const loginSection = document.getElementById("login-section");
const pontoSection = document.getElementById("ponto-section");
const painelRH = document.getElementById("painel-rh");
const msgErro = document.getElementById("msg-erro");
const boasVindas = document.getElementById("boas-vindas");
const alertaFerias = document.getElementById("alerta-ferias");

// ============================================================
// 🔐 LOGIN
// ============================================================
document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!email || !senha) {
    msgErro.textContent = "Preencha todos os campos.";
    return;
  }

  try {
    const resp = await fetch(API_URL + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro ao fazer login.");

    token = data.token;
    usuarioAtual = data.usuario;
    msgErro.textContent = "";

    if (["RH", "ADMIN"].includes(usuarioAtual.categoria)) {
      loginSection.classList.add("oculto");
      painelRH.classList.remove("oculto");
      carregarAbaFuncionarios();
    } else {
      loginSection.classList.add("oculto");
      pontoSection.classList.remove("oculto");
      boasVindas.textContent = `Olá, ${usuarioAtual.nome}`;
      verificarFerias();
    }
  } catch (err) {
    msgErro.textContent = err.message;
  }
});

// ============================================================
// 🌴 FÉRIAS - ALERTA AO LOGAR
// ============================================================
async function verificarFerias() {
  try {
    const resp = await fetch(API_URL + "/ferias/info", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await resp.json();

    if (data.statusFerias && data.statusFerias.startsWith("⚠️")) {
      alertaFerias.classList.remove("oculto");
      alertaFerias.textContent = data.statusFerias;
    } else {
      alertaFerias.classList.add("oculto");
    }
  } catch (err) {
    console.error("Erro ao verificar férias:", err);
  }
}

// ============================================================
// 📸 REGISTRAR PONTO COM FOTO
// ============================================================
async function capturarFoto() {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.play();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        setTimeout(() => {
          ctx.drawImage(video, 0, 0, 320, 240);
          stream.getTracks().forEach((t) => t.stop());
          canvas.toBlob(resolve, "image/jpeg", 0.8);
        }, 1500);
      })
      .catch(reject);
  });
}

async function registrarPonto(tipo) {
  try {
    const fotoBlob = await capturarFoto();
    const formData = new FormData();
    formData.append("tipo", tipo);
    if (fotoBlob) formData.append("foto", fotoBlob, "ponto.jpg");

    const resp = await fetch(API_URL + "/ponto/registrar", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });

    const data = await resp.json();
    if (resp.ok) alert("✅ Ponto registrado com sucesso!");
    else alert("Erro: " + (data.error || "Falha desconhecida"));
  } catch (err) {
    alert("Erro: " + err.message);
  }
}

document.getElementById("btn-entrada").addEventListener("click", () =>
  registrarPonto("entrada")
);
document.getElementById("btn-saida").addEventListener("click", () =>
  registrarPonto("saida")
);
document.getElementById("btn-intervalo").addEventListener("click", () => {
  alert("⏳ Intervalo de 15 minutos iniciado!");
  setTimeout(
    () => alert("⚠️ Intervalo finalizado. Retorne ao trabalho!"),
    15 * 60 * 1000
  );
});

// ============================================================
// 🌴 MODAL DE FÉRIAS (FUNCIONÁRIO VENDEDOR)
// ============================================================
const btnSolicitarFerias = document.getElementById("btn-solicitar-ferias");
const modalFerias = document.getElementById("modal-ferias");
const btnEnviarFerias = document.getElementById("btn-enviar-ferias");
const btnCancelarFerias = document.getElementById("btn-cancelar-ferias");
const feriasInfo = document.getElementById("ferias-info");
const selectTipoFerias = document.getElementById("tipo-ferias");

btnSolicitarFerias.addEventListener("click", async () => {
  try {
    const resp = await fetch(API_URL + "/ferias/ultimas", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await resp.json();

    if (data.ultimaFerias) {
      const inicio = data.ultimaFerias.dataInicio
        ? new Date(data.ultimaFerias.dataInicio).toLocaleDateString()
        : "-";
      const fim = data.ultimaFerias.dataFim
        ? new Date(data.ultimaFerias.dataFim).toLocaleDateString()
        : "-";
      const tipoTxt =
        data.ultimaFerias.tipo === "30dias"
          ? "30 dias corridos"
          : "15 + 15 dias";

      feriasInfo.innerHTML = `
        <p>🗓 Últimas férias: ${inicio} até ${fim}</p>
        <p>📋 Tipo: ${tipoTxt}</p>
      `;
    } else {
      feriasInfo.innerHTML =
        "<p>❌ Nenhum registro de férias anterior.</p>";
    }

    selectTipoFerias.value = "";
    modalFerias.classList.remove("oculto");
  } catch (err) {
    alert("Erro ao carregar informações de férias.");
  }
});

btnCancelarFerias.addEventListener("click", () =>
  modalFerias.classList.add("oculto")
);

btnEnviarFerias.addEventListener("click", async () => {
  const tipo = selectTipoFerias.value;
  if (!tipo) {
    alert("Selecione um tipo de férias para solicitar.");
    return;
  }

  try {
    const resp = await fetch(API_URL + "/ferias/solicitar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ tipo }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro ao solicitar férias.");

    alert("✅ Solicitação de férias enviada com sucesso!");
    modalFerias.classList.add("oculto");
  } catch (err) {
    alert(err.message);
  }
});

// ============================================================
// 🧩 PAINEL RH - ABAS
// ============================================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.remove("active")
    );
    document.querySelectorAll(".tab-content").forEach((t) =>
      t.classList.remove("active")
    );
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");

    if (btn.dataset.tab === "tab-funcionarios") carregarAbaFuncionarios();
    if (btn.dataset.tab === "tab-status") carregarStatusAdmin();
  });
});

// ============================================================
// 👥 RH - LISTA DE FUNCIONÁRIOS
// ============================================================
async function carregarAbaFuncionarios() {
  try {
    const resp = await fetch(API_URL + "/admin/funcionarios", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await resp.json();
    const tbody = document.querySelector("#tabela-funcionarios tbody");
    tbody.innerHTML = "";

    data.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.nome}</td>
        <td>${u.categoria}</td>
        <td>${u.turno}</td>
        <td>${u.dataAdmissao}</td>
        <td>
          <button class="btn-editar" data-id="${u.id}">✏️</button>
          <button class="btn-excluir" data-id="${u.id}">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-editar").forEach((b) =>
      b.addEventListener("click", () => abrirModalEdicao(b.dataset.id))
    );
    document.querySelectorAll(".btn-excluir").forEach((b) =>
      b.addEventListener("click", () => excluirFuncionario(b.dataset.id))
    );
  } catch (err) {
    console.error("Erro ao carregar funcionários:", err);
  }
}

// ============================================================
// ➕ CADASTRAR FUNCIONÁRIO (RH / ADMIN)
// ============================================================
const modalCadastro = document.getElementById("modal-cadastro");
const btnNovo = document.getElementById("btn-novo-funcionario");
const btnSalvar = document.getElementById("btn-salvar-func");
const btnFechar = document.getElementById("btn-fechar-modal");
const selectCategoriaCad = document.getElementById("cad-categoria");
const selectTurnoCad = document.getElementById("cad-turno");

btnNovo.addEventListener("click", () =>
  modalCadastro.classList.remove("oculto")
);
btnFechar.addEventListener("click", () =>
  modalCadastro.classList.add("oculto")
);

selectCategoriaCad.addEventListener("change", () => {
  if (selectCategoriaCad.value === "VENDEDOR")
    selectTurnoCad.classList.remove("oculto");
  else selectTurnoCad.classList.add("oculto");
});

btnSalvar.addEventListener("click", async () => {
  const nome = document.getElementById("cad-nome").value.trim();
  const email = document.getElementById("cad-email").value.trim();
  const cpf = document.getElementById("cad-cpf").value.trim();
  const telefone = document.getElementById("cad-telefone").value.trim();
  const dataAdmissao =
    document.getElementById("cad-data-admissao").value || null;
  const categoria = selectCategoriaCad.value;
  const turno = selectTurnoCad.value;
  const feriasTipoInicial =
    document.getElementById("cad-ferias-tipo").value || "nenhuma";

  if (!nome || !email || !cpf || !telefone || !categoria) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  try {
    const resp = await fetch(API_URL + "/admin/criar-funcionario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        nome,
        email,
        cpf,
        telefone,
        categoria,
        turno,
        dataAdmissao,
        feriasTipoInicial,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro ao cadastrar");

    alert(`✅ Funcionário cadastrado!\nSenha: ${data.senhaGerada}`);
    modalCadastro.classList.add("oculto");
    carregarAbaFuncionarios();
  } catch (err) {
    alert(err.message);
  }
});

// ============================================================
// ✏️ EDITAR FUNCIONÁRIO
// ============================================================
const modalEditar = document.getElementById("modal-editar");
const btnSalvarEdicao = document.getElementById("btn-salvar-edicao");
const btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");
let funcionarioEditando = null;

async function abrirModalEdicao(id) {
  const resp = await fetch(API_URL + `/admin/funcionario/${id}`, {
    headers: { Authorization: "Bearer " + token },
  });
  const user = await resp.json();
  funcionarioEditando = user;

  document.getElementById("edit-nome").value = user.nome;
  document.getElementById("edit-email").value = user.email;
  document.getElementById("edit-telefone").value = user.telefone || "";
  document.getElementById("edit-categoria").value = user.categoria;
  document.getElementById("edit-turno").value = user.turno || "";
  document.getElementById("edit-data-admissao").value =
    user.dataAdmissao || "";
  modalEditar.classList.remove("oculto");
}

btnCancelarEdicao.addEventListener("click", () =>
  modalEditar.classList.add("oculto")
);

btnSalvarEdicao.addEventListener("click", async () => {
  const nome = document.getElementById("edit-nome").value.trim();
  const email = document.getElementById("edit-email").value.trim();
  const telefone = document.getElementById("edit-telefone").value.trim();
  const categoria = document.getElementById("edit-categoria").value;
  const turno = document.getElementById("edit-turno").value;
  const dataAdmissao =
    document.getElementById("edit-data-admissao").value || null;

  try {
    const resp = await fetch(
      API_URL + `/admin/funcionario/${funcionarioEditando._id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          nome,
          email,
          telefone,
          categoria,
          turno,
          dataAdmissao,
        }),
      }
    );
    if (!resp.ok) throw new Error("Erro ao atualizar funcionário");

    alert("✅ Funcionário atualizado com sucesso!");
    modalEditar.classList.add("oculto");
    carregarAbaFuncionarios();
  } catch (err) {
    alert(err.message);
  }
});

// ============================================================
// 🗑 EXCLUIR FUNCIONÁRIO
// ============================================================
async function excluirFuncionario(id) {
  if (!confirm("Tem certeza que deseja excluir este funcionário?")) return;

  try {
    const resp = await fetch(API_URL + `/admin/funcionario/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    if (!resp.ok) throw new Error("Erro ao excluir funcionário");
    alert("🗑 Funcionário removido com sucesso!");
    carregarAbaFuncionarios();
  } catch (err) {
    alert(err.message);
  }
}

// ============================================================
// 📊 STATUS ADMINISTRATIVO
// ============================================================
async function carregarStatusAdmin() {
  try {
    const resp = await fetch(API_URL + "/admin/status", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await resp.json();

    const resumo = `
      <div class="status-card">👥 Funcionários<br>${data.funcionariosAtivos}</div>
      <div class="status-card">🕒 Pontos Hoje<br>${data.pontosHoje}</div>
      <div class="status-card">🌴 Férias Pendentes<br>${data.feriasPendentes}</div>
      <div class="status-card">🕓 Atualizado<br>${new Date(
        data.ultimaAtualizacao
      ).toLocaleTimeString()}</div>
    `;
    document.getElementById("status-resumo").innerHTML = resumo;

    const logs = data.logsRecentes.map((l) => `<li>${l}</li>`).join("");
    document.getElementById("status-logs").innerHTML = logs;

    const fotos = data.fotosRecentes
      .map((f) => `<img src="${f}" alt="Foto">`)
      .join("");
    document.getElementById("status-fotos").innerHTML = fotos;
  } catch (err) {
    console.warn("Erro ao carregar status:", err);
  }
}

// Atualização automática da aba “Status” a cada 10s
setInterval(() => {
  const abaAtiva = document.querySelector(".tab-content.active");
  if (abaAtiva && abaAtiva.id === "tab-status") carregarStatusAdmin();
}, 10000);

// ============================================================
// 📦 EXPORTAR CSV
// ============================================================
document.getElementById("btn-exportar-csv").addEventListener("click", async () => {
  try {
    const resp = await fetch(API_URL + "/admin/exportar", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!resp.ok) {
      alert("Erro ao gerar relatório.");
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_PontoDigital_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Erro ao baixar relatório:", err);
    alert("Falha ao baixar o relatório CSV.");
  }
});
