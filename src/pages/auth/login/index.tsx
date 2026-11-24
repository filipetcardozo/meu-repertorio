import Head from 'next/head'
import React from 'react'
import { useRedirectIfLogged } from '../../../hooks/useAuth';
import { LoginComponent } from '../../../components/app-auth/Login';

const Login = () => {
  useRedirectIfLogged()

  return <>
    <Head>
      <title>Entrar - Toca Mais Uma</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <LoginComponent />
  </>
}

export default Login;
