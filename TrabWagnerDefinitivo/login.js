const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Agora os IDs batem com o HTML: 'cpf' e 'senha'
        const campoCpf = document.getElementById('cpf');
        const campoSenha = document.getElementById('senha');

        if (!campoCpf || !campoSenha) {
            console.error("Erro: Campos não encontrados no HTML.");
            return;
        }

        const cpf = campoCpf.value.replace(/\D/g, '');
        const senha = campoSenha.value;

        try {
            console.log("Tentando login para o CPF:", cpf); // Para você acompanhar no F12

            const res = await fetch('/login-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, senha })
            });

            const dados = await res.json();

            if (res.ok) {
                console.log("Login bem-sucedido!");
                localStorage.setItem('nomeUsuario', dados.nome);
                localStorage.setItem('cpfUsuario', dados.cpf);
                
                // Redireciona usando a rota do vercel.json
                window.location.href = window.location.origin + "/home"; 
            } else {
                alert(dados.erro || "CPF ou senha incorretos.");
            }
        } catch (err) {
            console.error("Erro na conexão:", err);
            alert("Erro ao conectar com o servidor. Verifique a DATABASE_URL na Vercel.");
        }
    });
}
