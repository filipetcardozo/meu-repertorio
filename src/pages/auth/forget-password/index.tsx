import Head from 'next/head'
import React from 'react'
import { useRedirectIfLogged } from '../../../hooks/useAuth';
import { ForgotPassword } from '../../../components/app-auth/ForgotPassword';

const ForgetPassword = () => {
  useRedirectIfLogged()

  return <>
    <Head>
      <title>Recuperar senha - Toca Mais Uma</title>
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <ForgotPassword />
  </>
}

export default ForgetPassword;
