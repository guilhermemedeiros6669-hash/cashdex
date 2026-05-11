const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cpf = document.getElementById('cpf').value.replace(/\D/g, '');
        const senha = document.getElementById('senha').value;

        try {
            const res = await fetch('/login-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, senha })
            });

            const dados = await res.json();

            if (res.ok) {
                localStorage.setItem('nomeUsuario', dados.nome);
                localStorage.setItem('cpfUsuario', dados.cpf);
                window.location.href = 'home.html';
            } else {
                alert(dados.erro);
            }
        } catch (err) {
            alert("Erro ao conectar com o servidor.");
        }
    });
}
