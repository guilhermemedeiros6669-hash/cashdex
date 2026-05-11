const nome = localStorage.getItem('nomeUsuario');
const cpf = localStorage.getItem('cpfUsuario');

if (!cpf) {
    window.location.href = "/";
}

if (document.getElementById('boasVindas')) {
    document.getElementById('boasVindas').innerText = nome;
}

// Lógica de exibição do Card Open Finance vindo da URL
const params = new URLSearchParams(window.location.search);
if (params.get('conectado') === 'true') {
    const card = document.getElementById('cardOpenFinance');
    if (card) {
        card.style.display = 'block';
        document.getElementById('nomeBancoExterno').innerText = params.get('banco');
        const saldoValue = parseFloat(params.get('saldo'));
        document.getElementById('saldoExterno').innerText = `R$ ${saldoValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    }
}

async function carregarDados() {
    try {
        const resSaldo = await fetch(`/saldo/${cpf}`);
        const dadosSaldo = await resSaldo.json();
        document.getElementById('saldo').innerText = `R$ ${dadosSaldo.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

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
    } catch (err) {
        console.error("Erro ao carregar dados:", err);
    }
}

function abrirOpenFinance() {
    window.location.href = window.location.origin + "/conectar-larabank";
}

function sair() {
    localStorage.clear();
    window.location.href = "/";
}

carregarDados();
