# Chrome Web Store — textos do cadastro

## Store listing

**Description**

Busque e importe cifras do Cifra Club, do Cifras.com.br e do Ultimate Guitar direto para o Toca Mais Uma.

Ao buscar uma música no Toca Mais Uma (ou atualizar uma música que já tem link salvo), o app pede à extensão os resultados da busca e a cifra escolhida. A extensão carrega a página pelo seu navegador (quando preciso, em uma aba em segundo plano, fechada em seguida), lê a cifra, o tom e os dados da música e devolve tudo ao app para você revisar.

O que é importado:
• Cifra com acordes e tablaturas
• Tom, capotraste e afinação
• Artista, compositores e capa
• Ritmo/BPM e versões da cifra, quando a página informa

Privacidade:
• Só funciona quando o Toca Mais Uma pede a importação de uma música
• Só acessa páginas de busca e de música do Cifra Club, Cifras.com.br e Ultimate Guitar
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

Importar para o Toca Mais Uma a cifra da música que o usuário seleciona no app, buscando e lendo a página dessa música no Cifra Club, Cifras.com.br ou Ultimate Guitar.

**Justificativa — scripting**

Usada para ler a cifra, o tom e os dados da música na página do site de cifras que a extensão abre a pedido do Toca Mais Uma. O script roda só nessa aba, que é fechada logo após a leitura.

**Justificativa — host permissions (www.cifraclub.com.br, www.cifras.com.br, www.ultimate-guitar.com, tabs.ultimate-guitar.com)**

Necessárias para buscar a música e ler a página da cifra escolhida nesses três sites de cifras, pelo navegador do usuário. A extensão aceita só endereços de busca e de música desses sites, só a pedido do Toca Mais Uma, e não acessa nenhum outro site.

**Remote code:** No, I am not using remote code.

**Data usage:** marcar apenas "Website content" (conteúdo da página da cifra). Marcar as três declarações:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://tocamaisuma.com.br/privacidade-extensao.html (só funciona depois do deploy)

## Distribution

**Visibility:** Unlisted
**Regions:** All regions
