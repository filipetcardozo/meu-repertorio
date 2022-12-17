/* eslint-disable react-hooks/exhaustive-deps */
import Head from 'next/head'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../hooks/useAuth';
import { LoginComponent } from '../../../components/app-auth/Login';

const Login = () => {
    const router = useRouter()
    const { isLogged } = useAuth()

    useEffect(() => {
        if (isLogged === true) {
            router.push("/home")
        }
    }, [isLogged])

    return <>
        <Head>
            <title>Login - Meu Repertório</title>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        <LoginComponent />
    </>
}

export default Login;