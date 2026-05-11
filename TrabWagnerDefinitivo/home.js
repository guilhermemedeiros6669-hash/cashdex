// Pega os dados do usuário salvos no login
const nome = localStorage.getItem('nomeUsuario');
const cpf = localStorage.getItem('cpfUsuario');

if (!cpf) {
    window.location.href = "/";
}

document.getElementById('boasVindas').innerText = nome;

// Verifica se há dados de Open Finance na URL após o redirecionamento
const params = new URLSearchParams(window.location.search);
if (params.get('conectado') === 'true') {
    const card = document.getElementById('cardOpenFinance');
    const nomeBanco = params.get('banco');
    const saldoExterno = params.get('saldo');

    card.style.display = 'block';
    document.getElementById('nomeBancoExterno').innerText = nomeBanco;
    document.getElementById('saldoExterno').innerText = `R$ ${parseFloat(saldoExterno).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

async function carregarDados() {
    // Carregar Saldo
    const resSaldo = await fetch(`/saldo/${cpf}`);
    const dadosSaldo = await resSaldo.json();
    document.getElementById('saldo').innerText = `R$ ${dadosSaldo.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // Carregar Extrato
    const resExtrato = await fetch(`/extrato/${cpf}`);
    const extrato = await resExtrato.json();
    const lista = document.getElementById('listaTransacoes');
    lista.innerHTML = extrato.map(t => `
        <li>
            <span>${t.tipo}</span>
            <span style="color: ${t.tipo === 'Depósito' ? '#22c55e' : '#ef4444'}">
                ${t.tipo === 'Depósito' ? '+' : '-'} R$ ${parseFloat(t.valor).toFixed(2)}
            </span>
        </li>
    `).join('') || '<li>Nenhuma transação recente</li>';
}

function abrirOpenFinance() {
    // Redireciona para a rota do backend que inicia o OAuth
    window.location.href = "/conectar-larabank";
}

function sair() {
    localStorage.clear();
    window.location.href = "/";
}

// Funções de operação (saque/deposito/transferencia) seguem a mesma lógica de fetch...

carregarDados();
