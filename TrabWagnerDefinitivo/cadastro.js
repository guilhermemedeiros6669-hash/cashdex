const form = document.getElementById('cadastroForm');

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        
        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value.replace(/\D/g, ''),
            email: document.getElementById('email').value,
            senha: document.getElementById('senha').value,
            endereco: document.getElementById('endereco').value,
            nascimento: document.getElementById('nascimento').value
        };

        try {
            // Mudança aqui: usando rota relativa para a Vercel
            const resposta = await fetch('/cadastro-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            if (resposta.ok) {
                alert("Cadastro realizado! 🎉");
                window.location.href = `login.html?cpf=${dados.cpf}`;
            } else {
                const erro = await resposta.json();
                alert("Erro: " + erro.erro);
            }
        } catch (err) {
            alert("Erro na conexão com o servidor.");
        }
    });
}
