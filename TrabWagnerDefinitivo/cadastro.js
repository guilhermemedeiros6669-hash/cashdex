const form = document.getElementById('cadastroForm');

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); 
        
        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value.replace(/\D/g, ''), // Limpa CPF
            email: document.getElementById('email').value,
            senha: document.getElementById('senha').value,
            endereco: document.getElementById('endereco').value,
            nascimento: document.getElementById('nascimento').value
        };

        try {
            const resposta = await fetch('http://localhost:3000/cadastro', {
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
            alert("Servidor desligado.");
        }
    });
}