window.addEventListener('DOMContentLoaded', atualizarDados);

async function atualizarDados() {
    const nome = localStorage.getItem('nomeUsuario');
    const cpf = localStorage.getItem('cpfUsuario');

    if (!nome || !cpf) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('boasVindas').textContent = nome;
    
    try {
        // 1. Busca o Saldo no servidor
        const resSaldo = await fetch(`http://localhost:3000/saldo/${cpf}`);
        const dadosSaldo = await resSaldo.json();
        if (resSaldo.ok) {
            document.getElementById('saldo').textContent = `R$ ${parseFloat(dadosSaldo.saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }

        // 2. Busca o Extrato
        const resExtrato = await fetch(`http://localhost:3000/extrato/${cpf}`);
        const transacoes = await resExtrato.json();
        
        if (resExtrato.ok) {
            const lista = document.getElementById('listaTransacoes');
            lista.innerHTML = ''; 

            if (transacoes.length === 0) {
                lista.innerHTML = '<li style="color: #94a3b8;">Nenhuma transação encontrada.</li>';
            } else {
                transacoes.forEach(t => {
                    const li = document.createElement('li');
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.padding = '10px 0';
                    li.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                    
                    const eDeposito = t.tipo === 'Depósito';
                    const cor = eDeposito ? '#deff9a' : '#ff9a9a';
                    const sinal = eDeposito ? '+' : '-';

                    li.innerHTML = `
                        <span>${t.tipo}</span>
                        <span style="color: ${cor}; font-weight: bold;">
                            ${sinal} R$ ${parseFloat(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    `;
                    lista.appendChild(li);
                });
            }
        }
    } catch (err) {
        console.error("Erro ao carregar dados da Home:", err);
    }
}

// SIMULAÇÃO DE OPEN FINANCE
function abrirOpenFinance() {
    const banco = prompt("Digite o nome do banco que deseja conectar (Ex: Nubank, Itaú, Inter):");
    
    if (!banco) return;

    alert(`Conectando ao portal do ${banco}... Aguarde a autorização.`);

    // Simula o tempo de resposta da "API" do outro banco
    setTimeout(() => {
        const saldoSimulado = (Math.random() * 10000).toFixed(2);
        
        const card = document.getElementById('cardOpenFinance');
        const nomeTxt = document.getElementById('nomeBancoExterno');
        const saldoTxt = document.getElementById('saldoExterno');

        card.style.display = 'block';
        nomeTxt.textContent = `Saldo ${banco}`;
        saldoTxt.textContent = `R$ ${parseFloat(saldoSimulado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        
        alert(`✅ Integração via Open Finance com o ${banco} concluída!`);
    }, 2000);
}

async function operacao(tipo) {
    const cpf = localStorage.getItem('cpfUsuario');
    const valor = parseFloat(prompt(`Valor para ${tipo.toUpperCase()}:`));

    if (!valor || valor <= 0) return alert("Por favor, digite um valor válido.");

    try {
        const res = await fetch(`http://localhost:3000/${tipo}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, valor })
        });
        const d = await res.json();
        if (res.ok) {
            alert(`✅ ${d.mensagem}`);
            atualizarDados();
        } else {
            alert(`❌ Erro: ${d.erro}`);
        }
    } catch (err) {
        alert("Erro no servidor.");
    }
}

async function transferir() {
    const cpfOrigem = localStorage.getItem('cpfUsuario');
    const cpfDestino = prompt("CPF do destino (apenas números):");
    const valor = parseFloat(prompt("Valor da transferência:"));

    if (!cpfDestino || !valor || valor <= 0) return alert("Dados inválidos.");

    try {
        const res = await fetch('http://localhost:3000/transferencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpfOrigem, cpfDestino, valor })
        });
        const d = await res.json();
        if (res.ok) {
            alert(`✅ ${d.mensagem}`);
            atualizarDados();
        } else {
            alert(`❌ Erro: ${d.erro}`);
        }
    } catch (err) {
        alert("Erro na conexão.");
    }
}

function sair() {
    localStorage.clear();
    window.location.href = 'login.html';
}