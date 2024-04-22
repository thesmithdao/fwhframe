# Frames.js Next Faucet

Simple Faucet app using Frames.js and Next.

## Funcionamento

A aplicação é simples. A mesma API que faz os Frames, será a API que irá controlar os claims dos usuários, e também utilizando da carteira pela private key, enviar os tokens.

## Desenvolvimento

Para desenvolver sua própria versão do Faucet, comece clonando o repositório

```bash
git clone https://github.com/r4topunk/faucet-frame.git
cd faucet-frame
```

Depois, instale os pacote

```bash
pnpm install
```

Para abrir em modo de desenvolvimento use o comando

```bash
pnpm run dev
```

## Dependências

A aplicação utiliza o [Supabase](https://supabase.com/docs/guides/api) para guardar informações de interações dos usuários. Sendo assim necessário criar uma conta na plataforma, criar a tabela, e utiliza-la junto da aplicação.

## Variáveis de ambiente

O faucet conta com 3 variáveis de ambiente, sendo elas:

- `WALLET_PRIVATE_KEY` para a private key da carteira que será utilizada para enviar os tokens
- `SUPABASE_URL` para a url de acesso para Supabase
- `SUPABASE_KEY` para a chave de acesso para Supabase

Edite essas informações em `.env`

```bash
cp .env.example .env
```

## Deploy

Por conta do desenvolvimento ter sido feito utilizando Next.js, o deploy pode ser realizado na Vercel. E também, justamente por conta do desenvolvimento ser feito com Next, uma página web será criada para hospedar o site e receber as requisições.

Ao clicar na imagem do Frame dentro do Warpcast, você será enviado para a página web do Frame, nese caso, a página será a gerada pelo Next. Você pode edita-la em `app/page.tsx`.
