import fs from 'fs';

const sqlPath = 'Inspirações/controle_ausencias_tabela_unica.sql';
const sql = fs.readFileSync(sqlPath, 'utf8');

const admins = [
  {
    id: 'c2318237-b3f7-49ec-bb48-9d2a0c0c555d',
    nome: 'Admin',
    email: 'admin@phdengenharia.eng.br',
    senha: '968412',
    perfil: 'admin',
    ativo: true,
  }
];

const gestores = [];
const usuarios = [];
const ausencias = [];

const lines = sql.split('\n');
let insideInsert = false;
let userMap = {};

for (let line of lines) {
    if (line.includes(') VALUES')) {
        insideInsert = true;
        continue;
    }
    let t = line.trim();
    if (insideInsert && t.startsWith('(')) {
        // e.g. ('ADAILTON LUCAS GALINDO DE ANDRADE', 'adailton.andrade@phdengenharia.eng.br', 'CONSULTOR DE PLANEJAMENTO PL', 'TULIO RAFAEL MORAIS', 'LEONARDO AUGUSTO OLIVEIRA DRUMOND', DATE '2023-03-01', ...
        let content = t;
        if (content.endsWith('),') || content.endsWith(');')) {
            content = content.substring(1, content.length - 2);
        } else if (content.endsWith(')')) {
            content = content.substring(1, content.length - 1);
        }
        
        // Split by comma but ignore commas inside quotes
        let parts = content.split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/);
        
        if (parts.length >= 17) {
            const clean = (val) => {
                if (!val) return null;
                let v = val.trim();
                if (v === 'NULL' || v === 'None') return null;
                v = v.replace(/^DATE\s+/, '');
                v = v.replace(/^'|'$/g, '');
                return v;
            };

            let nome = clean(parts[0]);
            let email = clean(parts[1]);
            if (!email) email = `${nome.toLowerCase().replace(/\s+/g, '.')}@phdengenharia.eng.br`;
            let funcao = clean(parts[2]);
            let lider_direto = clean(parts[3]);
            let superior = clean(parts[4]);
            let data_admissao = clean(parts[5]);
            let ano_inicio = clean(parts[6]);
            let ano_fim = clean(parts[7]);
            let inicio_pa = clean(parts[8]);
            let fim_pa = clean(parts[9]);
            let limite_efetiva = clean(parts[10]);
            let saldo = clean(parts[11]);
            let qtd_programada = clean(parts[12]);
            let inicio_ausencia = clean(parts[13]);
            let fim_ausencia = clean(parts[14]);
            let dias_pendentes = clean(parts[15]);
            let status = clean(parts[16]);

            if (!userMap[nome]) {
                userMap[nome] = {
                    nome,
                    email,
                    senha: '123456',
                    primeiroAcesso: true,
                    funcao,
                    lider_direto,
                    superior,
                    dataAdmissao: data_admissao,
                    ativo: true
                };
            }

            ausencias.push({
                colaborador_nome: nome,
                ano_inicio,
                ano_fim,
                inicio_pa,
                fim_pa,
                limite_efetiva,
                saldo,
                qtd_programada,
                inicio_ausencia,
                fim_ausencia,
                dias_pendentes,
                status_original: status
            });
        }
    }
}

// Separate into gestores and usuarios
let gId = 1;
let uId = 1;
for (let nome in userMap) {
    let u = userMap[nome];
    // Check if user is a manager (if someone reports to them OR if they are their own leader)
    // Rule: Gestor is when they are their own leader direct OR if they appear as superior/lider_direto for others
    let isManager = (u.nome === u.lider_direto);
    
    if (isManager) {
        u.id = `gestor-${gId++}`;
        u.perfil = 'gestor';
        gestores.push(u);
    } else {
        u.id = `user-${uId++}`;
        u.perfil = 'usuario';
        usuarios.push(u);
    }
}

// Map superiorId and associate ausencias with user IDs
for (let u of [...gestores, ...usuarios]) {
    let gestor = gestores.find(g => g.nome === u.superior || g.nome === u.lider_direto);
    if (gestor) {
        u.superiorId = gestor.id;
    }
    
    // Link ausencias to this user
    ausencias.forEach(a => {
        if (a.colaborador_nome === u.nome) {
            a.colaborador_id = u.id;
        }
    });
}

const mockDataContent = `// ===== DADOS MOCKADOS — Sistema de Gestão de Ausência =====

// Admins
export const admins = ${JSON.stringify(admins, null, 2)};

// Gestores
export const gestores = ${JSON.stringify(gestores, null, 2)};

// Usuários (colaboradores)
export const usuarios = ${JSON.stringify(usuarios, null, 2)};

// Todas as Ausências (do SQL)
export const ausencias = ${JSON.stringify(ausencias, null, 2)};

// Solicitações de Ausência (Iniciadas no App)
export const solicitacoes = [];

// Helper: buscar todos os usuários (admins + gestores + usuarios)
export const todosUsuarios = [...admins, ...gestores, ...usuarios];

export const autenticar = (email, senha) => {
  return todosUsuarios.find(u => u.email === email && u.senha === senha && u.ativo);
};

export const getColaboradoresPorGestor = (gestorId) => {
  return usuarios.filter(u => u.superiorId === gestorId || u.id === gestorId);
};

export const getAusenciasPorColaborador = (colaboradorId) => {
  return ausencias.filter(a => a.colaborador_id === colaboradorId);
};

export const getStatusCalculado = (ausencia) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const statusOriginal = ausencia.status_original;
  const limiteEfetiva = ausencia.limite_efetiva ? new Date(ausencia.limite_efetiva + 'T00:00:00') : null;
  const fimPA = ausencia.fim_pa ? new Date(ausencia.fim_pa + 'T00:00:00') : null;

  if (statusOriginal === 'Ausência Marcada') {
    return { label: 'Ausência Marcada', cor: 'var(--success)', status: 'aprovada' };
  }
  
  if (statusOriginal === 'OK') {
    return { label: 'OK', cor: 'var(--blue)', status: 'concluida' };
  }
  
  if (statusOriginal === 'Sem direito ainda') {
    if (fimPA) {
      const tresMesesAntes = new Date(fimPA);
      tresMesesAntes.setMonth(tresMesesAntes.getMonth() - 3);
      if (hoje >= tresMesesAntes && hoje <= fimPA) {
        return { label: 'Sem direito ainda (Aviso)', cor: 'var(--warning)', status: 'aviso', nota: 'Faltam menos de 3 meses para o fim do P.A.' };
      }
    }
    return { label: 'Sem direito ainda', cor: 'var(--gray-400)', status: 'bloqueada' };
  }
  
  if (statusOriginal === 'Marcação Pendente') {
    if (limiteEfetiva && limiteEfetiva < hoje) {
      return { label: 'Atrasado para marcar', cor: 'var(--error)', status: 'atrasada' };
    }
    return { label: 'Marcação Pendente', cor: 'var(--warning)', status: 'pendente' };
  }
  
  return { label: statusOriginal, cor: 'var(--gray-400)', status: 'desconhecido' };
};

export const formatarData = (data) => {
  if (!data) return '—';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

export const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
`;

fs.writeFileSync('src/data/mockData.js', mockDataContent, 'utf8');
console.log("Mock data generated with", gestores.length, "gestores,", usuarios.length, "usuarios and", ausencias.length, "ausencias.");
