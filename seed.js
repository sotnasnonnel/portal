import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if(!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env variables");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const data = JSON.parse(fs.readFileSync('seed_data.json', 'utf8'));

// Format dates nicely
function validateDate(d) {
    if(!d) return null;
    d = String(d).trim();
    // Se for apenas o ano (4 dígitos)
    if(/^\d{4}$/.test(d)) {
        const year = parseInt(d);
        if (year > 1900 && year < 2100) return `${d}-01-01`;
    }
    // Se não tiver pelo menos o tamanho de YYYY-M-D, descarta
    if(d.length < 8) return null;
    // Se não começar como uma data ISO básica, descarta
    if(!/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
    return d;
}

async function run() {
    console.log("Seeding administradores e limpando relações...");
    
    // First pass: insert all without superior_id
    const colabsFirstPass = data.colaboradores.map(c => ({
        ...c,
        superior_id: null
    }));
    
    for (let i = 0; i < colabsFirstPass.length; i += 50) {
        const chunk = colabsFirstPass.slice(i, i + 50);
        const { error } = await supabase.from('colaboradores').upsert(chunk, { onConflict: 'id' });
        if (error) console.error("Error inserting first pass:", error);
    }
    
    // Second pass: update superior_id
    for (let c of data.colaboradores) {
        if(c.superior_id) {
            const { error } = await supabase.from('colaboradores')
                .update({ superior_id: c.superior_id })
                .eq('id', c.id);
            if(error) console.error("Error linking superior:", error);
        }
    }
    console.log("Colaboradores inserted & linked.");
    
    console.log("Seeding ciclos_ausencia...");
    const ciclosFixed = data.ciclos.map(c => ({
        ...c,
        inicio_periodo_aquisitivo: validateDate(c.inicio_periodo_aquisitivo),
        fim_periodo_aquisitivo: validateDate(c.fim_periodo_aquisitivo),
        limite_ausencia_efetiva: validateDate(c.limite_ausencia_efetiva),
        ausencia_agendada_inicio: validateDate(c.ausencia_agendada_inicio),
        ausencia_agendada_fim: validateDate(c.ausencia_agendada_fim)
    })).filter(c => c.inicio_periodo_aquisitivo && c.fim_periodo_aquisitivo);
    
    for (let i = 0; i < ciclosFixed.length; i += 50) {
        const chunk = ciclosFixed.slice(i, i + 50);
        const { error } = await supabase.from('ciclos_ausencia').upsert(chunk, { onConflict: 'id' });
        if (error) {
            console.error(`Error inserting ciclos:`, error);
        }
    }
    console.log("Ciclos inserted.");
}

run();
