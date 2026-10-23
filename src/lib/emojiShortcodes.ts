// Emojis por nome, como no WhatsApp: escrever ":so" sugere 😊 sorriso, 😴 sono, ☀️ sol…
// Nomes em português (e alguns em inglês, que muita gente usa). Sem bibliotecas externas.

export interface EmojiEntry {
  emoji: string;
  /** O primeiro é o nome que aparece na lista. */
  names: string[];
}

const E = (emoji: string, ...names: string[]): EmojiEntry => ({ emoji, names });

export const EMOJIS: EmojiEntry[] = [
  // Caras
  E('😀', 'sorriso', 'feliz', 'contente', 'smile'),
  E('😃', 'sorriso_grande', 'alegre', 'feliz'),
  E('😄', 'riso', 'sorriso_olhos', 'alegria'),
  E('😁', 'sorriso_dentes', 'riso', 'grin'),
  E('😆', 'gargalhada', 'riso', 'lol'),
  E('😅', 'suor', 'alivio', 'nervoso', 'ufa'),
  E('😂', 'lagrimas_de_riso', 'riso', 'rir', 'kkk', 'haha', 'joy'),
  E('🤣', 'rebolar_a_rir', 'riso', 'rofl'),
  E('🙂', 'sorriso_leve', 'ok', 'simpatico'),
  E('🙃', 'ao_contrario', 'ironia'),
  E('😉', 'piscar', 'piscadela', 'wink'),
  E('😊', 'sorriso_corado', 'timido', 'sorriso', 'blush'),
  E('😇', 'anjo', 'inocente', 'santo'),
  E('🥰', 'apaixonado', 'amor', 'coracoes'),
  E('😍', 'olhos_de_coracao', 'amor', 'adoro', 'paixao'),
  E('🤩', 'estrelas', 'deslumbrado', 'uau'),
  E('😘', 'beijo', 'beijinho', 'kiss'),
  E('😋', 'delicioso', 'saboroso', 'lingua'),
  E('😜', 'lingua_de_fora', 'brincadeira', 'maluco'),
  E('🤪', 'louco', 'maluco', 'doido'),
  E('🤗', 'abraco', 'abracar', 'hug'),
  E('🤭', 'mao_na_boca', 'ops', 'risinho'),
  E('🤫', 'silencio', 'segredo', 'shh'),
  E('🤔', 'pensar', 'pensativo', 'hmm', 'duvida', 'think'),
  E('🤨', 'sobrancelha', 'desconfiado', 'suspeito'),
  E('😐', 'neutro', 'serio', 'sem_expressao'),
  E('😑', 'inexpressivo', 'aborrecido'),
  E('😶', 'sem_boca', 'calado', 'mudo'),
  E('🙄', 'revirar_olhos', 'tedio', 'aff'),
  E('😏', 'sorriso_maroto', 'malandro', 'smirk'),
  E('😬', 'careta', 'constrangido', 'awkward'),
  E('😌', 'aliviado', 'calmo', 'sereno'),
  E('😔', 'pensativo_triste', 'desanimado'),
  E('😪', 'sonolento', 'sono'),
  E('😴', 'sono', 'dormir', 'cansado', 'zzz', 'sleep'),
  E('😷', 'mascara', 'doente', 'gripe'),
  E('🤒', 'febre', 'doente', 'termometro'),
  E('🤢', 'enjoado', 'nausea', 'nojo'),
  E('🤧', 'espirro', 'constipado', 'gripe'),
  E('🥵', 'calor', 'quente'),
  E('🥶', 'frio', 'gelado', 'congelado'),
  E('🤯', 'cabeca_a_explodir', 'chocado', 'uau'),
  E('🥳', 'festa', 'celebrar', 'aniversario', 'party'),
  E('😎', 'oculos_de_sol', 'fixe', 'cool', 'estilo'),
  E('🤓', 'nerd', 'oculos', 'estudioso'),
  E('😕', 'confuso', 'baralhado'),
  E('😟', 'preocupado', 'aflito'),
  E('🙁', 'triste_leve', 'chateado'),
  E('😮', 'surpreso', 'espanto', 'boca_aberta', 'wow'),
  E('😲', 'espantado', 'chocado', 'surpresa'),
  E('😳', 'envergonhado', 'corado', 'vergonha'),
  E('🥺', 'suplicar', 'por_favor', 'olhos_tristes'),
  E('😢', 'chorar', 'triste', 'lagrima', 'cry'),
  E('😭', 'chorar_muito', 'choro', 'triste', 'sob'),
  E('😱', 'grito', 'medo', 'susto', 'horror'),
  E('😖', 'frustrado', 'confundido'),
  E('😞', 'desiludido', 'triste'),
  E('😓', 'suor_frio', 'cansado'),
  E('😩', 'exausto', 'farto', 'cansado'),
  E('😫', 'esgotado', 'cansado'),
  E('🥱', 'bocejo', 'sono', 'aborrecido'),
  E('😤', 'bufar', 'irritado', 'determinado'),
  E('😡', 'zangado', 'furioso', 'raiva', 'angry'),
  E('😠', 'chateado', 'zangado'),
  E('🤬', 'palavrao', 'furioso', 'raiva'),
  E('😈', 'diabinho', 'malicia'),
  E('💀', 'caveira', 'morto_de_riso'),
  E('💩', 'coco', 'cocó'),
  E('🤡', 'palhaco'),
  E('👻', 'fantasma'),
  E('👽', 'extraterrestre', 'alien'),
  E('🤖', 'robo', 'robot', 'ia'),
  // Gestos e pessoas
  E('👍', 'polegar_para_cima', 'ok', 'gosto', 'like', 'sim', 'boa'),
  E('👎', 'polegar_para_baixo', 'nao_gosto', 'dislike', 'nao'),
  E('👌', 'ok', 'perfeito', 'certo'),
  E('✌️', 'paz', 'vitoria', 'dois'),
  E('🤞', 'dedos_cruzados', 'sorte', 'figas'),
  E('🤝', 'aperto_de_mao', 'acordo', 'negocio', 'combinado'),
  E('👏', 'palmas', 'aplausos', 'parabens', 'bravo'),
  E('🙌', 'maos_ao_ar', 'celebrar', 'viva'),
  E('🙏', 'por_favor', 'obrigado', 'rezar', 'agradecer', 'pray'),
  E('💪', 'forca', 'musculo', 'forte', 'bora'),
  E('👋', 'ola', 'adeus', 'acenar', 'tchau', 'wave'),
  E('🤙', 'liga_me', 'telefona', 'shaka'),
  E('☝️', 'atencao', 'um', 'dedo_para_cima'),
  E('👉', 'apontar_direita', 'aqui'),
  E('👈', 'apontar_esquerda'),
  E('👇', 'apontar_baixo', 'abaixo'),
  E('👆', 'apontar_cima', 'acima'),
  E('✍️', 'escrever', 'assinar'),
  E('🤷', 'encolher_ombros', 'sei_la', 'nao_sei'),
  E('🤦', 'mao_na_cara', 'facepalm', 'oh_nao'),
  E('🙋', 'mao_levantada', 'eu', 'presente'),
  E('👀', 'olhos', 'olhar', 'ver'),
  E('🧠', 'cerebro', 'inteligente', 'ideia'),
  // Corações e símbolos
  E('❤️', 'coracao', 'amor', 'love', 'heart'),
  E('🧡', 'coracao_laranja'),
  E('💛', 'coracao_amarelo'),
  E('💚', 'coracao_verde'),
  E('💙', 'coracao_azul'),
  E('💜', 'coracao_roxo'),
  E('🖤', 'coracao_preto'),
  E('🤍', 'coracao_branco'),
  E('💔', 'coracao_partido', 'desgosto'),
  E('💕', 'dois_coracoes', 'carinho'),
  E('💯', 'cem', 'perfeito', 'cem_por_cento'),
  E('🔥', 'fogo', 'incrivel', 'top', 'fire'),
  E('⭐', 'estrela', 'star'),
  E('🌟', 'estrela_brilhante', 'destaque'),
  E('✨', 'brilho', 'magia', 'novo'),
  E('⚡', 'raio', 'rapido', 'energia'),
  E('💥', 'explosao', 'bum'),
  E('💤', 'zzz', 'dormir', 'sono'),
  E('✅', 'certo', 'feito', 'concluido', 'visto', 'ok', 'check'),
  E('☑️', 'caixa_com_visto', 'feito'),
  E('✔️', 'visto', 'certo'),
  E('❌', 'errado', 'nao', 'cancelar', 'x'),
  E('❗', 'exclamacao', 'importante', 'atencao'),
  E('❓', 'pergunta', 'interrogacao', 'duvida'),
  E('⚠️', 'aviso', 'atencao', 'cuidado', 'perigo'),
  E('🚫', 'proibido', 'nao'),
  E('🆗', 'ok'),
  E('🆕', 'novo', 'new'),
  E('🔴', 'vermelho', 'circulo_vermelho'),
  E('🟢', 'verde', 'circulo_verde', 'disponivel'),
  E('🟡', 'amarelo', 'circulo_amarelo'),
  // Trabalho e escritório
  E('📌', 'pin', 'fixar', 'alfinete'),
  E('📎', 'clipe', 'anexo'),
  E('📅', 'calendario', 'data', 'agenda'),
  E('🗓️', 'calendario_espiral', 'agenda'),
  E('⏰', 'alarme', 'despertador', 'hora'),
  E('⏳', 'ampulheta', 'espera', 'tempo', 'a_carregar'),
  E('🕐', 'relogio', 'hora', 'uma_hora'),
  E('📞', 'telefone', 'chamada', 'ligar'),
  E('📱', 'telemovel', 'celular', 'smartphone'),
  E('💻', 'computador', 'portatil', 'laptop'),
  E('🖥️', 'monitor', 'computador'),
  E('🖨️', 'impressora', 'imprimir'),
  E('⌨️', 'teclado'),
  E('📧', 'email', 'correio'),
  E('✉️', 'envelope', 'carta', 'mensagem'),
  E('📨', 'email_recebido', 'entrada'),
  E('📤', 'enviado', 'saida', 'upload'),
  E('📥', 'recebido', 'entrada', 'download'),
  E('📁', 'pasta', 'arquivo'),
  E('📂', 'pasta_aberta'),
  E('📄', 'documento', 'pagina', 'papel'),
  E('📝', 'nota', 'apontamento', 'memo'),
  E('📋', 'prancheta', 'lista', 'checklist'),
  E('📊', 'grafico', 'estatistica', 'relatorio'),
  E('📈', 'subir', 'crescimento', 'tendencia'),
  E('📉', 'descer', 'queda'),
  E('💼', 'pasta_de_trabalho', 'trabalho', 'negocios', 'mala'),
  E('💡', 'ideia', 'lampada'),
  E('🔒', 'cadeado', 'fechado', 'seguro'),
  E('🔑', 'chave', 'acesso', 'senha'),
  E('🔧', 'chave_inglesa', 'reparar', 'ferramenta'),
  E('🛠️', 'ferramentas', 'arranjar', 'manutencao'),
  E('⚙️', 'definicoes', 'engrenagem', 'configurar'),
  E('🔍', 'lupa', 'procurar', 'pesquisar'),
  E('🔔', 'sino', 'notificacao', 'aviso'),
  E('📣', 'megafone', 'anuncio', 'comunicado'),
  E('🎯', 'alvo', 'objetivo', 'meta'),
  E('🚀', 'foguetao', 'lancamento', 'rapido'),
  E('🏆', 'trofeu', 'vencedor', 'campeao'),
  E('🥇', 'medalha_de_ouro', 'primeiro'),
  E('💰', 'saco_de_dinheiro', 'dinheiro', 'pagamento'),
  E('💶', 'euro', 'dinheiro', 'nota'),
  E('💳', 'cartao', 'pagamento'),
  E('🧾', 'fatura', 'recibo', 'talao'),
  E('🏢', 'escritorio', 'empresa', 'edificio'),
  E('🏠', 'casa', 'lar'),
  E('🚗', 'carro', 'automovel'),
  E('🚙', 'jipe', 'suv'),
  E('🚚', 'camiao', 'entrega', 'transporte'),
  E('🛵', 'mota', 'scooter', 'entrega'),
  E('✈️', 'aviao', 'viagem', 'voo'),
  E('⛽', 'combustivel', 'gasolina', 'bomba'),
  E('🔋', 'bateria', 'energia'),
  // Festa, comida e natureza
  E('🎉', 'festa', 'parabens', 'celebracao', 'tada'),
  E('🎊', 'confetes', 'festa'),
  E('🎂', 'bolo', 'aniversario', 'parabens'),
  E('🎁', 'presente', 'prenda', 'oferta'),
  E('🎈', 'balao', 'festa'),
  E('🍾', 'champanhe', 'celebrar'),
  E('🥂', 'brinde', 'saude', 'celebrar'),
  E('🍻', 'cerveja', 'brinde', 'copos'),
  E('🍷', 'vinho'),
  E('☕', 'cafe', 'pausa', 'bica', 'coffee'),
  E('🍕', 'pizza'),
  E('🍔', 'hamburguer'),
  E('🍰', 'fatia_de_bolo', 'sobremesa'),
  E('🍫', 'chocolate'),
  E('🍎', 'maca', 'fruta'),
  E('☀️', 'sol', 'calor', 'dia', 'sun'),
  E('🌞', 'sol_com_cara', 'bom_dia'),
  E('🌙', 'lua', 'noite', 'boa_noite'),
  E('⛅', 'nublado', 'nuvens'),
  E('🌧️', 'chuva', 'chover'),
  E('⛈️', 'trovoada', 'tempestade'),
  E('❄️', 'neve', 'frio', 'floco'),
  E('🌈', 'arco_iris'),
  E('🌸', 'flor', 'primavera'),
  E('🌹', 'rosa', 'flor'),
  E('🌱', 'planta', 'crescer', 'rebento'),
  E('🌍', 'mundo', 'terra', 'planeta'),
  E('🏖️', 'praia', 'ferias', 'verao'),
  E('🐶', 'cao', 'cachorro', 'dog'),
  E('🐱', 'gato', 'cat'),
  E('🦄', 'unicornio'),
  E('⚽', 'futebol', 'bola'),
  E('🎵', 'musica', 'nota_musical'),
  E('🎧', 'auscultadores', 'musica', 'phones'),
  E('📷', 'camara', 'fotografia', 'foto'),
  E('🎬', 'filme', 'cinema', 'claquete'),
  E('🇵🇹', 'portugal', 'bandeira_portugal'),
  E('🇧🇷', 'brasil', 'bandeira_brasil'),
];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** ":so" mesmo antes do cursor (no início ou depois de um espaço): devolve onde começa e o texto. */
export const emojiQueryAt = (
  text: string,
  caret: number
): { start: number; query: string } | null => {
  const before = text.slice(0, caret);
  const match = /(^|\s):([\p{L}_]{2,30})$/u.exec(before);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
};

/** Emojis cujo nome começa pelo texto (sem acentos); depois os que o contêm. */
export const searchEmojis = (query: string, limit = 12): { emoji: string; name: string }[] => {
  const q = fold(query);
  const found: { emoji: string; name: string; rank: number }[] = [];
  for (const entry of EMOJIS) {
    const names = entry.names.map(fold);
    // 0: o nome principal começa assim; 1: outro nome; 2: uma palavra do nome; 3: contém.
    const ranked = names
      .map((name, index) => ({
        name,
        rank: name.startsWith(q)
          ? index === 0
            ? 0
            : 1
          : name.split('_').some(word => word.startsWith(q))
            ? 2
            : name.includes(q)
              ? 3
              : 9,
      }))
      .sort((x, y) => x.rank - y.rank)[0];
    if (ranked && ranked.rank < 9) found.push({ emoji: entry.emoji, ...ranked });
  }
  // Entre iguais, o nome mais curto primeiro (sol, sono, sorriso…).
  return found
    .sort((x, y) => x.rank - y.rank || x.name.length - y.name.length)
    .slice(0, limit)
    .map(({ emoji, name }) => ({ emoji, name }));
};

/** Troca ":so" pelo emoji escolhido (com um espaço a seguir) e devolve o texto e o cursor. */
export const insertEmoji = (
  text: string,
  start: number,
  caret: number,
  emoji: string
): { text: string; caret: number } => {
  const next = `${text.slice(0, start)}${emoji} ${text.slice(caret)}`;
  return { text: next, caret: start + emoji.length + 1 };
};
