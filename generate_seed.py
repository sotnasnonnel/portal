import uuid
import json

sql_path = 'Inspirações/controle_ausencias_tabela_unica.sql'

with open(sql_path, 'r', encoding='utf-8') as f:
    sql = f.read()

user_map = {}
lines = sql.split('\n')
inside_insert = False

for line in lines:
    if ') VALUES' in line:
        inside_insert = True
        continue
    t = line.strip()
    if inside_insert and t.startswith('('):
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
                
                inicio_pa = str(row[6]) if row[6] else None
                fim_pa = str(row[7]) if row[7] else None
                limite_efetiva = str(row[8]) if row[8] else None
                status_atual = str(row[9]) if row[9] else None
                ausencia_inicio = str(row[10]) if row[10] else None
                ausencia_fim = str(row[11]) if row[11] else None
                
                if nome not in user_map:
                    user_map[nome] = {
                        "id": str(uuid.uuid4()),
                        "nome": nome,
                        "email": email,
                        "funcao": funcao,
                        "lider_direto": lider_direto,
                        "data_admissao": data_admissao,
                        "ciclos": []
                    }
                
                user_map[nome]["ciclos"].append({
                    "id": str(uuid.uuid4()),
                    "inicio_pa": inicio_pa,
                    "fim_pa": fim_pa,
                    "limite_efetiva": limite_efetiva,
                    "status_atual": status_atual,
                    "ausencia_inicio": ausencia_inicio,
                    "ausencia_fim": ausencia_fim
                })
        except Exception as e:
            pass

for nome, u in user_map.items():
    if u["nome"] == u["lider_direto"]:
        u["perfil"] = "gestor"
    else:
        u["perfil"] = "usuario"

for nome, u in user_map.items():
    gestor_nome = u["lider_direto"]
    superior = user_map.get(gestor_nome)
    if superior:
        u["superior_id"] = superior["id"]
    else:
        u["superior_id"] = None

colaboradores = []
ciclos = []

# Admin
admin_id = str(uuid.uuid4())
colaboradores.append({
    "id": admin_id,
    "nome": "Lennon Administrador",
    "email": "admin@phdengenharia.eng.br",
    "perfil": "admin",
    "ativo": True,
    "funcao": None,
    "superior_id": None,
    "data_admissao": None
})

for nome, u in user_map.items():
    colaboradores.append({
        "id": u["id"],
        "nome": u["nome"],
        "email": u["email"],
        "funcao": u["funcao"],
        "perfil": u["perfil"],
        "superior_id": u["superior_id"],
        "data_admissao": u["data_admissao"],
        "ativo": True
    })

for nome, u in user_map.items():
    col_id = u["id"]
    for c in u["ciclos"]:
        inicio = c["inicio_pa"]
        fim = c["fim_pa"]
        saf = c["status_atual"]
        
        if not inicio or inicio == 'NaT':
            continue
            
        sat = str(saf).replace("nan", "Sem status").replace("NaT", "Sem status")
        if sat == 'None' or sat == '': sat = "Sem status"
        
        ciclos.append({
            "id": c["id"],
            "colaborador_id": col_id,
            "inicio_periodo_aquisitivo": inicio,
            "fim_periodo_aquisitivo": fim,
            "limite_ausencia_efetiva": c["limite_efetiva"] if c["limite_efetiva"] != 'NaT' else None,
            "status_atual": sat,
            "ausencia_agendada_inicio": c["ausencia_inicio"] if c["ausencia_inicio"] != 'NaT' else None,
            "ausencia_agendada_fim": c["ausencia_fim"] if c["ausencia_fim"] != 'NaT' else None
        })

with open("seed_data.json", "w", encoding="utf-8") as f:
    json.dump({"colaboradores": colaboradores, "ciclos": ciclos}, f, ensure_ascii=False, indent=2)

print("Generated seed_data.json")
