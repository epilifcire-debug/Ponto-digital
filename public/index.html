<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ponto Digital | Point do Ingresso + Pré-Caju</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="icon" href="favicon.ico" />
</head>
<body>
  <!-- ========================================================== -->
  <!-- 🌈 CABEÇALHO -->
  <!-- ========================================================== -->
  <header id="header">
    <div class="header-content">
      <img src="images.png" alt="Logo Point do Ingresso" class="logo" />
      <img src="Logo-do-Pre-Caju-1.png" alt="Logo Pré-Caju" class="logo" />
      <h1>Ponto Digital</h1>
    </div>
  </header>

  <!-- ========================================================== -->
  <!-- 🔐 LOGIN -->
  <!-- ========================================================== -->
  <section id="login-section" class="section">
    <div class="card">
      <h2>Login</h2>
      <input type="email" id="email" placeholder="E-mail" />
      <input type="password" id="senha" placeholder="Senha" />
      <button id="btn-login">Entrar</button>
      <p id="msg-erro" class="msg-erro"></p>
    </div>
  </section>

  <!-- ========================================================== -->
  <!-- 👷 FUNCIONÁRIO -->
  <!-- ========================================================== -->
  <section id="ponto-section" class="section oculto">
    <div class="card">
      <h2 id="boas-vindas">Olá, Funcionário</h2>
      <button id="btn-logout-func" class="btn-logout">🚪 Sair</button>

      <div id="alerta-ferias" class="msg-alert oculto"></div>

      <div class="btn-group">
        <button id="btn-entrada">Bater Entrada</button>
        <button id="btn-saida">Bater Saída</button>
        <button id="btn-intervalo">Intervalo</button>
      </div>

      <div class="func-opcoes">
        <button id="btn-solicitar-ferias">Solicitar Férias</button>
        <button id="btn-trocar-horario">Trocar Horário</button>
      </div>

      <div id="meu-ponto" class="card-info">
        <h3>📋 Meu Ponto</h3>
        <p><strong>Último Registro:</strong> <span id="ultimo-registro">–</span></p>
        <p><strong>Horas Trabalhadas:</strong> <span id="horas-trabalhadas">–</span></p>
        <p><strong>Banco de Horas:</strong> <span id="banco-horas">–</span></p>
      </div>
    </div>
  </section>

  <!-- ========================================================== -->
  <!-- 🧑‍💼 PAINEL RH -->
  <!-- ========================================================== -->
  <section id="painel-rh" class="section oculto">
    <div class="card">
      <h2>Painel RH / Administrativo</h2>
      <button id="btn-logout-rh" class="btn-logout">🚪 Sair</button>

      <div class="tab-nav">
        <button class="tab-btn active" data-tab="tab-funcionarios">👥 Funcionários</button>
        <button class="tab-btn" data-tab="tab-status">📊 Status</button>
      </div>

      <div id="tab-funcionarios" class="tab-content active">
        <button id="btn-novo-funcionario" class="btn-add">➕ Novo Funcionário</button>
        <table id="tabela-funcionarios">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Turno</th>
              <th>Admissão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <div id="tab-status" class="tab-content">
        <div id="status-resumo" class="status-cards"></div>
        <div class="status-section">
          <h4>📜 Logs Recentes</h4>
          <ul id="status-logs"></ul>
        </div>
        <div class="status-section">
          <h4>📸 Últimas Fotos</h4>
          <div id="status-fotos" class="foto-galeria"></div>
        </div>
        <button id="btn-exportar-csv" class="btn-export">⬇️ Exportar Relatório CSV</button>
      </div>
    </div>
  </section>

  <!-- ========================================================== -->
  <!-- 🧾 MODAL CADASTRO FUNCIONÁRIO -->
  <!-- ========================================================== -->
  <div id="modal-cadastro" class="modal oculto">
    <div class="modal-content">
      <h3>Novo Funcionário</h3>
      <input id="cad-nome" placeholder="Nome completo" />
      <input id="cad-email" placeholder="E-mail" />
      <input id="cad-cpf" placeholder="CPF" />
      <input id="cad-telefone" placeholder="Telefone" />
      <label>Categoria:</label>
      <select id="cad-categoria">
        <option value="RH">RH</option>
        <option value="VENDEDOR">VENDEDOR</option>
      </select>
      <label id="label-turno">Turno:</label>
      <select id="cad-turno" class="oculto">
        <option value="MANHA">Manhã</option>
        <option value="TARDE">Tarde</option>
      </select>

      <label>Data de Admissão:</label>
      <input type="date" id="cad-admissao" />

      <div class="modal-actions">
        <button id="btn-salvar-func">Salvar</button>
        <button id="btn-fechar-modal" class="cancelar">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- ========================================================== -->
  <!-- ✏️ MODAL EDITAR FUNCIONÁRIO -->
  <!-- ========================================================== -->
  <div id="modal-editar" class="modal oculto">
    <div class="modal-content">
      <h3>Editar Funcionário</h3>
      <input id="edit-nome" placeholder="Nome completo" />
      <input id="edit-email" placeholder="E-mail" />
      <input id="edit-telefone" placeholder="Telefone" />
      <label>Categoria:</label>
      <select id="edit-categoria">
        <option value="RH">RH</option>
        <option value="VENDEDOR">VENDEDOR</option>
      </select>
      <label>Turno:</label>
      <select id="edit-turno">
        <option value="MANHA">Manhã</option>
        <option value="TARDE">Tarde</option>
      </select>

      <!-- 🏖️ CAMPOS DE FÉRIAS MANUAIS -->
      <hr />
      <h4>📆 Férias Já Tiradas</h4>
      <label>Tipo de Férias:</label>
      <select id="edit-ferias-tipo">
        <option value="">Nenhuma</option>
        <option value="30dias">30 dias corridos</option>
        <option value="15em15">15 + 15 dias</option>
      </select>

      <label>Data de Início:</label>
      <input type="date" id="edit-ferias-inicio" />

      <label>Data de Término:</label>
      <input type="date" id="edit-ferias-fim" />

      <div class="modal-actions">
        <button id="btn-salvar-edicao">Salvar</button>
        <button id="btn-cancelar-edicao" class="cancelar">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- ========================================================== -->
  <!-- 🌴 MODAL SOLICITAR FÉRIAS -->
  <!-- ========================================================== -->
  <div id="modal-ferias" class="modal oculto">
    <div class="modal-content">
      <h3>Solicitar Férias</h3>
      <div id="ferias-info"></div>
      <select id="tipo-ferias">
        <option value="">Selecione o tipo</option>
        <option value="30dias">30 dias corridos</option>
        <option value="15em15">15 + 15 dias</option>
      </select>
      <div class="modal-actions">
        <button id="btn-enviar-ferias">Enviar Solicitação</button>
        <button id="btn-cancelar-ferias" class="cancelar">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- ========================================================== -->
  <!-- 🔁 MODAL TROCA DE HORÁRIO -->
  <!-- ========================================================== -->
  <div id="modal-troca" class="modal oculto">
    <div class="modal-content">
      <h3>Solicitar Troca de Turno</h3>
      <input id="troca-email" placeholder="E-mail do outro vendedor" />
      <label>Data da Troca:</label>
      <input id="troca-data" type="date" />
      <div class="modal-actions">
        <button id="btn-enviar-troca">Enviar Solicitação</button>
        <button id="btn-cancelar-troca" class="cancelar">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- ========================================================== -->
  <!-- 🔗 SCRIPTS -->
  <!-- ========================================================== -->
  <script src="app.js"></script>
</body>
</html>
