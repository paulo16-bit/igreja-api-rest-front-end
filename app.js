const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Configuração de sessão
app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const API_URL = 'http://localhost:8080';

// Verifica se o usuário está autenticado
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const response = await axios.post(`${API_URL}/auth/login`, { usuario, senha });
        const user = response.data;

        req.session.user = user;
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Usuário ou senha inválidos' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/', async (req, res) => {
    try {
        const now = new Date();
        const mes = req.query.mes || (now.getMonth()+1).toString().padStart(2, '0');
        const ano = req.query.ano || now.getFullYear().toString();
    
        const { data: totais } = await axios.get(`${API_URL}/movimentacoes/totais`, {
          params: { mes, ano }
        });
    
        const { data: saldo} = await axios.get(`${API_URL}/movimentacoes/totalGeral`);
    
        res.render('index', {
          user: req.session.user,
          totais,
          saldo,
          mes: mes,
          ano: ano,
          formatCurrency: (value) => 
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
        });
    
      } catch (error) {
        console.error('Erro ao buscar totais:', error);
        res.render('index', {
          user: req.session.user,
          totais: { dizimo: 0, oferta: 0, despesa: 0 },
          saldo: 0,
          mes: (new Date().getMonth() + 1).toString().padStart(2, '0'),
          ano: new Date().getFullYear().toString(),
          formatCurrency: (value) => `R$ ${(value || 0).toFixed(2)}`
        });
      }
    });

app.get('/dizimos', async (req, res) => {
    try {
        const now = new Date();
        const mes = req.query.mes || (now.getMonth()+1).toString().padStart(2, '0');
        const ano = req.query.ano || now.getFullYear().toString();

        const response = await axios.get(`${API_URL}/movimentacoes`, {
            params: { tipo: 'dizimo', mes, ano }
        });

        res.render('dizimos', { dizimos: response.data, mes, ano });
    } catch (error) {
        console.error('Erro ao buscar dízimos:', error.message);
        res.status(500).send('Erro ao buscar os dízimos');
    }
});

app.get('/ofertas', async (req, res) => {
    try {
        const now = new Date();
        const mes = req.query.mes || (now.getMonth()+1).toString().padStart(2, '0');
        const ano = req.query.ano || now.getFullYear().toString();

        const response = await axios.get(`${API_URL}/movimentacoes`, {
            params: { tipo: 'oferta', mes, ano }
        });

        res.render('ofertas', { ofertas: response.data, mes, ano });
    } catch (error) {
        console.error('Erro ao buscar ofertas:', error.message);
        res.render('ofertas', { ofertas: [], error: 'Erro ao buscar as ofertas' });
    }
});

app.get('/despesas', async (req, res) => {
    try {
        const now = new Date();
        const mes = req.query.mes || (now.getMonth()+1).toString().padStart(2, '0');

        const response = await axios.get(`${API_URL}/movimentacoes`, {
            params: { tipo: 'despesa', mes, ano }
        });

        res.render('despesas', { despesas: response.data, mes, ano });
    } catch (error) {
        console.error('Erro ao buscar despesas:', error.message);
        res.render('despesas', { despesas: [], error: 'Erro ao buscar as despesas' });
    }
});

app.get('/novo/:tipo', async (req, res) => {
    const tipo = req.params.tipo;
    try {
        const response = await axios.get(`${API_URL}/auth`);
        res.render('cadastro', { usuarios: response.data, tipo });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error.message);
        res.status(500).send('Erro ao carregar formulário');
    }
});

app.post('/novo/:tipo', async (req, res) => { 
    const tipo = req.params.tipo;
    const { descricao, valor, data, usuarioId } = req.body;

    const movimentacao = {
        descricao,
        valor,
        tipo,
        data,
        usuarioId
    };

    if (tipo !== 'dizimo') {
        movimentacao.usuarioId = null;
    }

    try {
        await axios.post(`${API_URL}/movimentacoes`, movimentacao);
        if (tipo === 'dizimo') {
            res.redirect('/dizimos');
        } else if (tipo === 'oferta') {
            res.redirect('/ofertas');
        } else if (tipo === 'despesa') {
            res.redirect('/despesas');
        }
    } catch (error) {
        console.error('Erro ao cadastrar movimentação:', error.response?.data || error.message);
        res.status(500).send('Erro ao cadastrar movimentação');
    }
});

app.get('/editar/:id', async (req, res) => {
    const id = req.params.id;
    
    try {
        const response = await axios.get(`${API_URL}/movimentacoes/${id}`);
        const movimentacao = response.data;
        const usuariosResponse = await axios.get(`${API_URL}/auth`);
        const usuarios = usuariosResponse.data;

        res.render('editar', { movimentacao, usuarios });
    } catch (error) {
        console.error('Erro ao buscar movimentação para edição:', error.message);
        res.status(500).send('Erro ao carregar formulário de edição');
    }
});

app.post('/editar/:id', async (req, res) => {
    const id = req.params.id;
    const { descricao, valor, tipo, data, usuarioId } = req.body;

    const movimentacao = {
        descricao,
        valor,
        tipo,
        data,
        usuarioId
    };

    if (tipo !== 'dizimo') {
        movimentacao.usuarioId = null;
    }

    try {
        await axios.put(`${API_URL}/movimentacoes/${id}`, movimentacao);
        res.redirect('/');
    } catch (error) {
        console.error('Erro ao atualizar movimentação:', error.response?.data || error.message);
        res.status(500).send('Erro ao atualizar movimentação');
    }
});

app.delete('/excluir/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await axios.delete(`${API_URL}/movimentacoes/${id}`);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao excluir movimentação');
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log('Servidor rodando na porta 3000');
});