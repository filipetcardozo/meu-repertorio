/** Erro com status HTTP e mensagem já pronta para o usuário. */
export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
