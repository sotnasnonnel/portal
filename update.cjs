const fs = require('fs');

const dataList = `
ADAILTON LUCAS GALINDO DE ANDRADE	adailton.andrade@phdengenharia.eng.br
ALEX POSSIDONIO DA SILVA	alex.silva@phdengenharia.eng.br
ANA REGINA REZENDE CALDEIRA	ana.caldeira@phdengenharia.eng.br
ANDERSON NONATO DOS SANTOS	anderson.santos@phdengenharia.eng.br
ANDRE LUIZ COSTA GUIMARAES	andre.guimaraes@phdengenharia.eng.br
ANDREY LUZ SOUSA	andrey.sousa@phdengenharia.eng.br
ANGELA MARIA LOPES CAMPOS	angela.campos@phdengenharia.eng.br
ARTHUR JOSE TEIXEIRA ANDRADE	arthur.andrade@phdengenharia.eng.br
ARTUR VIEIRA JANUTH	artur.januth@phdengenharia.eng.br
BRENDO HENRIQUE LOPES	brendo.lopes@phdengenharia.eng.br
BRUNO ALBERTO AZEVEDO	bruno.azevedo@phdengenharia.eng.br
DANIEL CARLOS SILVA	daniel.carlos@phdengenharia.eng.br
DANIEL DOS SANTOS ALMEIDA	daniel.almeida@phdengenharia.eng.br
DANIEL MIRANDA CABRAL DE SOUSA	daniel.sousa@phdengenharia.eng.br
DEIVIDY ALVES GOMES	deividy.gomes@phdengenharia.eng.br
DIANY STEFFANE FERREIRA SANTANA	diany.santana@phdengenharia.eng.br
DIEGO FIRME BERNARDES	diego.bernardes@phdengenharia.eng.br
DIEGO RANIERI MELO RODRIGUES	diego.rodrigues@phdengenharia.eng.br
DIOGO HENRIQUE SOARES	diogo.soares@phdengenharia.eng.br
EDUARDO DOS REIS ELER	eduardo.eler@phdengenharia.eng.br
EDUARDO FERREIRA DA SILVA	eduardo.ferreira@phdengenharia.eng.br
FABIO DE JESUS OLIVEIRA	fabio.oliveira@phdengenharia.eng.br
FILIPHE CARVALHO DOS SANTOS	filiphe.santos@phdengenharia.eng.br
FRANCISCO BECARI JUNIOR	francisco.junior@phdengenharia.eng.br
GABRIEL DE ANDRADE ABUD	gabriel.abud@phdengenharia.eng.br
GABRIEL FRANCISCO DOS SANTOS	gabriel.santos@phdengenharia.eng.br
GETULIO ALVES PEDROSA	getulio.pedrosa@phdengenharia.eng.br
GUSTAVO BICALHO NOGUEIRA MARQUES	gustavo.marques@phdengenharia.eng.br
GUSTAVO VIEIRA LANA	gustavo.lana@phdengenharia.eng.br
GUTEMBERG GOMES ROSA DA SILVA	gutemberg.silva@phdengenharia.eng.br
HUDSON JUAN MACHADO VILELA	hudson.vilela@phdengenharia.eng.br
ICARO ANTONIO DUQUE BAHIA	icaro.bahia@phdengenharia.eng.br
ISAC RODRIGUES HORTA	isac.horta@phdengenharia.eng.br
IVAN VERVE SANTOS SILVA	ivan.silva@phdengenharia.eng.br
IVANO ROBERTO SILVA DA CRUZ	ivano.cruz@phdengenharia.eng.br
JADER THIAGO SILVA CORREA	jader.correa@phdengenharia.eng.br
JAKELINE RAYANE BARROS FELIX	jakeline.felix@phdengenharia.eng.br
JARBAS DE MAGALHAES SILVA JUNIOR	jarbas.junior@phdengenharia.eng.br
JEFERSON EXPEDITO DE OLIVEIRA SILVA	jeferson.expedito@phdengenharia.eng.br
JEFFERSON MAGALHAES DE SA	jefferson.magalhaes@phdengenharia.eng.br
JOSE ANTONIO RIBEIRO VARGAS	jose.vargas@phdengenharia.eng.br
JULIA BRANDAO ROCHA	julia.brandao@phdengenharia.eng.br
JULIO CESAR SILVA	julio.cesar@phdengenharia.eng.br
KARINE VITORIA MADEIRA GAMA	karine.vitoria@phdengenharia.eng.br
LENNON MICHAEL MOREIRA SANTOS	lennon.santos@phdengenharia.eng.br
LEONARDO AUGUSTO OLIVEIRA DRUMOND	leonardo.drumond@phdengenharia.eng.br
LUCAS ANDRADE BATISTA	lucas.batista@phdengenharia.eng.br
LUCAS DE ASSIS BRAGA	lucas.assis@phdengenharia.eng.br
LUCAS EDUARDO NORBERTO BARROSO	lucas.barroso@phdengenharia.eng.br
LUCAS FERRAZ GONCALVES	lucas.ferraz@phdengenharia.eng.br
LUCAS PEDRO ZACARIAS	lucas.zacarias@phdengenharia.eng.br
LUCIANA DE FATIMA FERREIRA	luciana.ferreira@phdengenharia.eng.br
LUIZ GUSTAVO LOPES DOS SANTOS	luiz.lopes@phdengenharia.eng.br
LUIZ HENRIQUE FERNANDES BRANDAO	luiz.fernandes@phdengenharia.eng.br
MAICON HENRIQUE VIEIRA MORAIS	maicon.morais@phdengenharia.eng.br
MARCELO FERRAZ LIMA	marcelo.lima@phdengenharia.eng.br
MARCIO WALDIR BORGES MUELLER JUNIOR	marcio.junior@phdengenharia.eng.br
MARCOS ANTONIO ALMEIDA FERRAIS	marcos.ferrais@phdengenharia.eng.br
MARLON WITOR BORGES MUELLER	marlon.mueller@phdengenharia.eng.br
MATEUS FILIPE CORRADI DE MORAIS	mateus.corradi@phdengenharia.eng.br
MATEUS NASCIMENTO CEREJO ZICO	mateus.cerejo@phdengenharia.eng.br
MATHEUS PERA	matheus.pera@phdengenharia.eng.br
MATHEUS SANTOS COSTA	matheus.costa@phdengenharia.eng.br
NILTON DE SORDI NETTO	nilton.netto@phdengenharia.eng.br
PAULO CEZAR DE PAIVA NETO	paulo.paiva@phdengenharia.eng.br
PAULO SERGIO DA SILVA COSTA JUNIOR	paulo.junior@phdengenharia.eng.br
PEDRO HENRIQUE BOSCO NERY	pedro.nery@phdengenharia.eng.br
PEDRO HENRIQUE BRAGA DE MORAIS	pedro.morais@phdengenharia.eng.br
PEDRO IVO DA SILVA BATISTA FILHO	pedro.filho@phdengenharia.eng.br
PIETRO MATEUS HOLTHAUSEN ROSA	pietro.rosa@phdengenharia.eng.br
POLYANE GOMES DE LANES	polyane.lanes@phdengenharia.eng.br
ROBERTO RIBEIRO GUIMARAES DE MEDEIROS	roberto.medeiros@phdengenharia.eng.br
RODOLPHO GUEDES FONSECA	rodolpho.fonseca@phdengenharia.eng.br
RODRIGO MARTINS BRANDOLT	rodrigo.brandolt@phdengenharia.eng.br
RODRIGO MORAIS TEIXEIRA	rodrigo.teixeira@phdengenharia.eng.br
RONALDO MENDES MACHADO	ronaldo.machado@phdengenharia.eng.br
ROSILAINE DA SILVA VAZ	rosilaine.vaz@phdengenharia.eng.br
RUBENS RODRIGUES DA SILVA	rubens.silva@phdengenharia.eng.br
SILAS MOREIRA TUPINAMBA	silas.moreira@phdengenharia.eng.br
TALLES COSMI GONCALVES	talles.goncalves@phdengenharia.eng.br
THALES SANDER CARVALHO DE PADUA	thales.padua@phdengenharia.eng.br
THIAGO ANDRADE CAMBRAIA	thiago.cambraia@phdengenharia.eng.br
TULIO RAFAEL DE MORAIS NEIVA	tulio.rafael@phdengenharia.eng.br
VICTOR GOMES AGUIAR	victor.aguiar@phdengenharia.eng.br
VICTOR HUGO SILVA MOTA	victor.mota@phdengenharia.eng.br
VINICIUS ANDALECIO DA SILVA COSTA	vinicius.costa@phdengenharia.eng.br
WANTUIL TORREZANI OLIVEIRA	wantuil.oliveira@phdengenharia.eng.br
WARLEY SANTOS MARTINS NOGUEIRA	warley.nogueira@phdengenharia.eng.br
YAN CAUE DA SILVA	yan.silva@phdengenharia.eng.br
YAN LUCCA DE ALMEIDA MOREIRA	yan.moreira@phdengenharia.eng.br
LAURA DE CASTRO SAMPAIO	laura.sampaio@phdengenharia.eng.br
EMERSON DE MELO FERREIRA DA SILVA	emerson.silva@phdengenharia.eng.br
PEDRO GABRIEL SANTOS CHAVES	pedro.chaves@phdengenharia.eng.br
RONEY ANDERSON ROSA DA SILVA	roney.silva@phdengenharia.eng.br
FABIO CARDOSO DOS SANTOS	fabio.santos@phdengenharia.eng.br
FERNANDA LOPES DE LIGORIO	fernanda.ligorio@phdengenharia.eng.br
MATEUS FREITAS DE SOUZA	mateus.souza@phdengenharia.eng.br
DIVINO FELICIO SANTOS	divino.santos@phdengenharia.eng.br
ARTHUR FARHAT BENEDITO	arthur.benedito@phdengenharia.eng.br
RAFAEL DINIZ FLORENCIO	rafael.florencio@phdengenharia.eng.br
MARIANA VENTURA SILVA	mariana.silva@phdengenharia.eng.br
RAYKLEISON SOUSA COSTA	raykleison.costa@phdengenharia.eng.br
DIEGO SOARES ANTUNES	diego.antunes@phdengenharia.eng.br
FELIPE SANTOS ARAUJO	felipe.araujo@phdengenharia.eng.br
RODRIGO ASSIS ROCHA	rodrigo.rocha@phdengenharia.eng.br
TAINARA PEREIRA RODRIGUES	tainara.rodrigues@phdengenharia.eng.br
ALEXANDER FLAMENGO BRITO RODRIGUES	alexander.rodrigues@phdengenharia.eng.br
THIAGO SILVA LETRO	thiago.letro@phdengenharia.eng.br
VALTECI LEANDRO DE OLIVEIRA	valteci.oliveira@phdengenharia.eng.br
`;

const emailMap = {};
dataList.trim().split('\n').forEach(line => {
    let parts = line.split('\t');
    if (parts.length === 2) {
        emailMap[parts[0].trim().toUpperCase()] = parts[1].trim();
    }
});

const sqlFile = 'Inspirações/controle_ausencias_tabela_unica.sql';
let sql = fs.readFileSync(sqlFile, 'utf8');

// Update table definition
sql = sql.replace('nome TEXT NOT NULL,', 'nome TEXT NOT NULL,\n    email TEXT,');

// Update column list for INSERT
sql = sql.replace('nome,\n    funcao,', 'nome,\n    email,\n    funcao,');

// Update INSERT values
let lines = sql.split('\n');
let insideInsert = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes(') VALUES')) {
        insideInsert = true;
        continue;
    }
    
    if (insideInsert && line.trim().startsWith('(')) {
        // Extract name to map
        let match = line.match(/\('([^']+)'/);
        if (match) {
            let name = match[1];
            // Get email, use NULL if not found
            let email = emailMap[name.toUpperCase()];
            // Try to match ignoring accents maybe? Or just use what we have.
            // There are some accents in names possibly? Let's check:
            // "TÚLIO" "SILAS MOREIRA TUPINAMBÁ". Actually in the text list it might not have accents. Let's do a basic normalization check if undefined.
            if (!email) {
               // try removing common accents
               let normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
               email = emailMap[normalized];
            }
            if (!email) {
                // Another try: exact exact match check (sometimes spaces differ)
                let simplifiedName = name.replace(/\s+/g, ' ').trim().toUpperCase();
                email = emailMap[simplifiedName];
            }
            
            let emailStr = email ? `'${email}'` : 'NULL';
            
            // Insert email right after the name
            // example: ('ADAILTON...', 'CONSULTOR...
            // becomes: ('ADAILTON...', 'ada@...', 'CONSULTOR...
            lines[i] = line.replace(/'([^']+)',/, `'$1', ${emailStr},`);
        }
    }
}

fs.writeFileSync(sqlFile, lines.join('\n'), 'utf8');
console.log('Done mapping emails!');
