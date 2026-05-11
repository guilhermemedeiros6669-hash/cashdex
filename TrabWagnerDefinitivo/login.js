const loginForm = document.getElementById('loginForm');

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const cpfUrl = urlParams.get('cpf');
    if (cpfUrl) document.getElementById('cpfLogin').value = cpfUrl;
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cpf = document.getElementById('cpfLogin').value.replace(/\D/g, ''); // Limpa CPF
    const senha = document.getElementById('senhaLogin').value;

    try {
        const resposta = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, senha })
        });

        const resultado = await resposta.json();
        if (resposta.ok) {
            localStorage.setItem('nomeUsuario', resultado.nome);
            localStorage.setItem('cpfUsuario', resultado.cpf);
            window.location.href = 'home.html';
        } else {
            alert(resultado.erro);
        }
    } catch (err) {
        alert("Erro de conexão.");
    }
});