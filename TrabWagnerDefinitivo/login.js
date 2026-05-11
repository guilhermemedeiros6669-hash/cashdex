const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Limpa o CPF para garantir que apenas números sejam enviados
        const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
        const senha = document.getElementById('senha').value;

        try {
            // Chamada para a rota configurada no vercel.json
            const res = await fetch('/login-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, senha })
            });

            const dados = await res.json();

            if (res.ok) {
                // Salva os dados na sessão do navegador
                localStorage.setItem('nomeUsuario', dados.nome);
                localStorage.setItem('cpfUsuario', dados.cpf);
                
                // Redireciona para a rota amigável da Home
                window.location.href = "/home"; 
            } else {
                // Exibe erro vindo do banco de dados (ex: senha incorreta)
                alert(dados.erro || "Falha no login");
            }
        } catch (err) {
            alert("Erro ao conectar com o servidor. Verifique sua conexão.");
        }
    });
}
