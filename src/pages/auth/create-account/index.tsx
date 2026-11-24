import Head from 'next/head'
import React from 'react'
import { useRedirectIfLogged } from '../../../hooks/useAuth';
import { CreateAccount as CreateAccountComponent } from '../../../components/app-auth/CreateAccount';

const CreateAccount = () => {
  useRedirectIfLogged()

  return <>
    <Head>
      <title>Criar conta - Toca Mais Uma</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <CreateAccountComponent />
  </>
}

export default CreateAccount;
