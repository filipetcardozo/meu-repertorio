/* eslint-disable react-hooks/exhaustive-deps */
import Head from 'next/head'
import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../hooks/useAuth';
import { CreateAccount as CreateAccountComponent } from '../../../components/app-auth/CreateAccount/index';

const CreateAccount = () => {
    const router = useRouter()
    const { isLogged } = useAuth()

    useEffect(() => {
        if (isLogged === true) {
            router.push("/home")
        }
    }, [isLogged])

    return <>
        <Head>
            <title>Criação de conta - Meu Repertório</title>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        {/* <Image
            src={loginBackground}
            alt="Background da página de login"
            layout="fill"
            style={{ zIndex: -10 }}
        /> */}
        <CreateAccountComponent />
    </>
}

export default CreateAccount;