# Chrome Web Store — textos do cadastro

## Store listing

**Description**

Importe cifras do Cifra Club direto para o Toca Mais Uma.

Ao buscar uma música no Toca Mais Uma (ou atualizar uma música que já tem link salvo), o app pede à extensão a cifra daquela página. A extensão abre a música no Cifra Club em uma aba em segundo plano, lê a cifra, o tom e os dados da música, devolve tudo ao app para você revisar e fecha a aba.

O que é importado:
• Cifra com acordes e tablaturas
• Tom, capotraste e afinação
• Artista, compositores e capa
• Ritmo/BPM e versões da cifra, quando a página informa

Privacidade:
• Só funciona quando o Toca Mais Uma pede a importação de uma música
• Só acessa páginas de música em www.cifraclub.com.br
• Não lê senhas, histórico nem outras abas e não guarda nenhum dado

Requer o Chrome para computador e uma conta no Toca Mais Uma.

**Category:** Productivity → Tools (ou "Ferramentas")
**Language:** Português (Brasil)
**Store icon:** browser-extension/icon-128.png
**Screenshot:** browser-extension/store/screenshot-1280x800.png
**Official URL / Homepage:** https://tocamaisuma.com.br
**Support URL:** https://tocamaisuma.com.br

## Privacy

**Single purpose**

Importar para o Toca Mais Uma a cifra da música que o usuário seleciona no app, lendo a página dessa música no Cifra Club.

**Justificativa — scripting**

Usada para ler a cifra, o tom e os dados da música na página do Cifra Club que a extensão abre a pedido do Toca Mais Uma. O script roda só nessa aba, que é fechada logo após a leitura.

**Justificativa — host permission (https://www.cifraclub.com.br/*)**

Necessária para abrir e ler a página da música selecionada no Cifra Club. A extensão não acessa nenhum outro site.

**Remote code:** No, I am not using remote code.

**Data usage:** marcar apenas "Website content" (conteúdo da página da cifra). Marcar as três declarações:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://tocamaisuma.com.br/privacidade-extensao.html (só funciona depois do deploy)

## Distribution

**Visibility:** Unlisted
**Regions:** All regions
