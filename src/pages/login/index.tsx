/* eslint-disable react-hooks/exhaustive-deps */
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography'
import Head from 'next/head'

import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import LoadingButton from '@mui/lab/LoadingButton';
import LyricsIcon from '@mui/icons-material/Lyrics';
import { signInWithEmailAndPassword, getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { useEffect, useState } from 'react'
import { ContactMailSharp } from '@mui/icons-material';
import { width } from '@mui/system';
import { useRouter } from 'next/router'
import Image from 'next/image'
import loginBackground from '../../../public/login-background.jpg'

// Firebase
import { useAuth } from '../../hooks/useAuth';

interface LoginInfosInterface {
    email: string;
    password: string;
}

function Copyright(props: any) {
    return (
        <Typography variant="body2" color="text.secondary" align="center" {...props}>
            {'Copyright © '}
            <Link color="inherit" href="https://www.linkedin.com/in/filipe-cardozo-b5388a190/" target="_blank">
                Filipe Cardozo
            </Link>{' '}
            {new Date().getFullYear()}
            {'.'}
        </Typography>
    );
}

const LoginComponent = () => {
    const [loginInfos, setLoginInfos] = useState<LoginInfosInterface>({ email: "", password: "" })
    const router = useRouter()
    const { signIn, loading, isLogged } = useAuth()

    const handleLoginInfos = (event: any) => {
        if (event.target.name == "email") {
            loginInfos.email = event.target.value
        } else if (event.target.name == "password") {
            loginInfos.password = event.target.value
        }

        setLoginInfos({ ...loginInfos })
    }

    const [errorInputs, setErrorInputs] = useState({ loginError: false, passwordError: false })

    const validateInputs = () => {
        const validateEmail = (email: string) => {
            let emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            let result = email.match(emailRegex) ? true : false
            return result
        };
        const validatePassword = (password: string) => {
            let passw = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/
            let result = password.match(passw) ? true : false
            return result
        }

        let emailIsValid = validateEmail(loginInfos.email)
        if (!emailIsValid) {
            errorInputs.loginError = true
        } else {
            errorInputs.loginError = false
        }

        let passwordIsValid = validatePassword(loginInfos.password)
        if (!passwordIsValid) {
            errorInputs.passwordError = true
        } else {
            errorInputs.passwordError = false
        }

        setErrorInputs({ ...errorInputs })

        return emailIsValid && passwordIsValid
    }


    const login = () => {
        let validInfos = validateInputs()
        if (validInfos) {
            signIn(loginInfos)
        } else {
            return;
        }
    }

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
        <Image
            src={loginBackground}
            alt="Background da página de login"
            layout="fill"
            style={{ zIndex: -10 }}
        />
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: "center",
                width: "100%",
                height: "95vh"
            }}
        >
            <Box
                sx={{
                    backgroundColor: "#f5faffde",
                    minWidth: 300,
                    py: 6,
                    px: 2,
                    boxShadow: 15,
                    borderRadius: 2
                }}
            >

                <Box sx={{ textAlign: "center", displey: "flex", justifyContent: "center" }}>
                    <Typography component="h1" variant="h5" color="#127be3">
                        Meu Repertório
                    </Typography>
                </Box>
                <Box component="form" noValidate sx={{ mt: 1 }}>
                    <TextField
                        onChange={handleLoginInfos}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email"
                        name="email"
                        autoComplete="email"
                        autoFocus
                    />
                    <TextField
                        onChange={handleLoginInfos}
                        error={errorInputs.passwordError}
                        helperText={errorInputs.passwordError ? "Senha inválida." : ""}
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Senha"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                    />
                    {/* <FormControlLabel
                        control={<Checkbox value="remember" color="primary" />}
                        label="Manter logado"
                    /> */}
                    <LoadingButton
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        onClick={() => login()}
                        loading={loading}
                    >
                        Entrar
                    </LoadingButton>
                    <Grid container>
                        <Grid item xs>
                            <Link href="#" variant="body2">
                                Esqueceu a senha?
                            </Link>
                        </Grid>
                        <Grid item>
                            <Link href="#" variant="body2">
                                {"Criar uma conta"}
                            </Link>
                        </Grid>
                    </Grid>
                </Box>
                <Copyright sx={{ mt: 8, mb: 4 }} />
            </Box>
        </Box>
    </>
}

export default LoginComponent;