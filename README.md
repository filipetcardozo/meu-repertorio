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
