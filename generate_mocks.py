import json
import re

sql_path = 'Inspirações/controle_ausencias_tabela_unica.sql'
with open(sql_path, 'r', encoding='utf-8') as f:
    sql = f.read()

admins = [
  {
    "id": "admin-1",
    "nome": "Lennon Administrador",
    "email": "admin@phdengenharia.eng.br",
    "senha": "968412",
    "perfil": "admin",
    "ativo": True
  }
]

gestores = []
usuarios = []
user_map = {}

lines = sql.split('\n')
inside_insert = False

for line in lines:
    if ') VALUES' in line:
        inside_insert = True
        continue
    t = line.strip()
    if inside_insert and t.startswith('('):
        # make it python evaluable tuple
        py_t = t.replace('DATE ', '')
        py_t = py_t.replace(' NULL,', ' None,')
        if py_t.endswith(','):
            py_t = py_t[:-1]
        try:
            row = eval(py_t)
            if len(row) >= 6:
                nome = str(row[0])
                email = row[1] if row[1] is not None else ''
                if email == '':
                    email = nome.replace(" ", "").lower() + "@phdengenharia.eng.br"
                
                funcao = str(row[2])
                lider_direto = str(row[3])
                superior = str(row[4])
                data_admissao = str(row[5])
                
                if nome not in user_map:
                    user_map[nome] = {
                        "nome": nome,
                        "email": email,
                        "senha": "123456",
                        "primeiroAcesso": True,
                        "funcao": funcao,
                        "lider_direto": lider_direto,
                        "superior": superior,
                        "dataAdmissao": data_admissao,
                        "ativo": True
                    }
        except Exception as e:
            pass

g_id = 1
u_id = 1

for nome, u in user_map.items():
    if u["nome"] == u["lider_direto"]:
        u["id"] = f"gestor-{g_id}"
        g_id += 1
        u["perfil"] = "gestor"
        gestores.append(u)
    else:
        u["id"] = f"user-{u_id}"
        u_id += 1
        u["perfil"] = "usuario"
        usuarios.append(u)

for u in usuarios:
    gestor = next((g for g in gestores if g["nome"] == u["lider_direto"]), None)
    if gestor:
        u["superiorId"] = gestor["id"]
    u["superior"] = u["lider_direto"]
    del u["lider_direto"]

for g in gestores:
    del g["lider_direto"]

mock_data_content = f"""// ===== DADOS MOCKADOS — Sistema de Gestão de Ausência =====

// Admins
export const admins = {json.dumps(admins, indent=2, ensure_ascii=False)};

// Gestores
export const gestores = {json.dumps(gestores, indent=2, ensure_ascii=False)};

// Usuários (colaboradores)
export const usuarios = {json.dumps(usuarios, indent=2, ensure_ascii=False)};

// Solicitações de Ausência
export const solicitacoes = [];

// Helper: buscar todos os usuários (admins + gestores + usuarios)
export const todosUsuarios = [...admins, ...gestores, ...usuarios];

export const autenticar = (email, senha) => {{
  return todosUsuarios.find(u => u.email === email && u.senha === senha && u.ativo);
}};

export const atualizarUsuario = (id, dados) => {{
}};

export const getColaboradoresPorGestor = (gestorId) => {{
  return usuarios.filter(u => u.superiorId === gestorId || u.id === gestorId);
}};

export const getSolicitacoesPorGestor = (gestorId) => {{
  return solicitacoes.filter(s => s.gestorId === gestorId);
}};

export const getSolicitacoesPorUsuario = (usuarioId) => {{
  return solicitacoes.filter(s => s.usuarioId === usuarioId);
}};

export const formatarData = (data) => {{
  if (!data) return '—';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}};

export const formatarMoeda = (valor) => {{
  if (!valor && valor !== 0) return '—';
  return valor.toLocaleString('pt-BR', {{ style: 'currency', currency: 'BRL' }});
}};

export const calcularPeriodoAquisitivo = (dataAdmissao) => {{
  const admissao = new Date(dataAdmissao + 'T00:00:00');
  const hoje = new Date();
  let inicioPA = new Date(admissao);

  while (true) {{
    const fimPA = new Date(inicioPA);
    fimPA.setFullYear(fimPA.getFullYear() + 1);
    fimPA.setDate(fimPA.getDate() - 1);
    if (fimPA >= hoje) {{
      return {{
        inicio: inicioPA,
        fim: fimPA,
        texto: `${{formatarData(inicioPA.toISOString().split('T')[0])}} - ${{formatarData(fimPA.toISOString().split('T')[0])}}`,
      }};
    }}
    inicioPA.setFullYear(inicioPA.getFullYear() + 1);
  }}
}};
"""

# Convert Python True/False to true/false in formatting
mock_data_content = mock_data_content.replace('True', 'true').replace('False', 'false')

with open('src/data/mockData.js', 'w', encoding='utf-8') as f:
    f.write(mock_data_content)

print(f"Mock data generated with {len(gestores)} gestores and {len(usuarios)} usuarios.")
