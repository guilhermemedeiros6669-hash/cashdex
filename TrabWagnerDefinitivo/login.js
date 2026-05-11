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

            // Tenta ler a resposta do servidor
            const dados = await res.json();

            if (res.ok) {
                // Salva os dados na sessão do navegador (localStorage)
                localStorage.setItem('nomeUsuario', dados.nome);
                localStorage.setItem('cpfUsuario', dados.cpf);
                
                // Redireciona para a rota configurada no vercel.json
                // Usamos o caminho absoluto para evitar erros de pasta
                window.location.href = window.location.origin + "/home"; 
            } else {
                // Exibe erro vindo do banco de dados (ex: senha incorreta)
                alert(dados.erro || "Falha no login");
            }
        } catch (err) {
            console.error("Erro no login:", err);
            alert("Servidor desligado ou erro de conexão.");
        }
    });
}
