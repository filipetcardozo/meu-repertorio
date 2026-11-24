# Meu Repertório

Meu Repertório is a platform that allows the creation and management of sheet music quickly, among other diverse features, making the musician's life much happier.
Access the platform at this link: [Meu Repetório](https://www.meurepertorio.com)

## Installation

Use the package manager [yarn](https://classic.yarnpkg.com/lang/en/docs/) to install Meu Repertório.

```node
yarn install
```

## Running locally

1. Copy the example env file and fill in your Firebase web app config (Firebase Console > Project settings > General > Your apps):

```bash
cp .env.example .env.local
```

2. Start the dev server:

```bash
yarn dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Extensão de importação do Cifra Club

Para testar no Chrome desktop, abra `chrome://extensions`, ative o **Modo do desenvolvedor** e selecione **Carregar sem compactação**. Escolha a pasta `browser-extension` deste repositório. No app local, busque “Traição” de Vitinho e selecione o resultado, ou abra **Atualizar do Cifra Club** em uma música com link salvo. A extensão carrega a cifra em uma aba em segundo plano e devolve a prévia ao app.

### Publicação na Chrome Web Store

1. Gere o ZIP com `powershell -File scripts/package-cifra-extension.ps1`. O pacote em `build/` tem o manifesto na raiz e usa apenas as origens HTTPS do app. A chave pública do manifesto original mantém o ID fixo da instalação descompactada.
2. Crie um item no [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) e envie o ZIP. Use `browser-extension/icon-128.png` como ícone da loja e adicione uma captura de 1280 × 800 mostrando a prévia de importação.
3. Na seção de privacidade, descreva a finalidade da extensão como importar a cifra da música selecionada para cadastro ou atualização no Meu Repertório. A permissão `scripting` lê a página carregada e a permissão de host se limita a `www.cifraclub.com.br`. Informe a URL `/privacidade-extensao.html` no domínio público do app, após publicar a página. Se a tela de importação exigir login para a revisão, inclua instruções de acesso e uma conta de teste no campo privado do painel.
4. Em **Distribuição**, selecione **Não listado** para disponibilizar a instalação pelo link do app. Envie o item para revisão. Configure `NEXT_PUBLIC_CIFRA_EXTENSION_ID` na Vercel com o ID do item da loja e gere um novo deploy. Após a publicação, o link **Instalar extensão** estará disponível no alerta de importação.

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

## Tasks that need to be done

### Essentials tasks
- [ ] Creation of the user management page
- [ ] Creation of the approval page for lyrics
- [ ] Fix login and account creation page

### Secondary tasks
- [ ] Create page for viewing the repertoire on mobile
- [ ] Adapt home page to show songs that the user prefers
- [ ] Create some way to show the amount of views a certain song has

## License

[MIT](https://choosealicense.com/licenses/mit/)
