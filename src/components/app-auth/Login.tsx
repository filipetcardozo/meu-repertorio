import LoadingButton from "@mui/lab/LoadingButton"
import { Box, Grid, TextField, Typography } from "@mui/material"
import Link from "next/link"
import React, { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { Copyright } from "./Copyright"

interface LoginInfosInterface {
    email: string;
    password: string;
}

export const LoginComponent = () => {
    const [loginInfos, setLoginInfos] = useState<LoginInfosInterface>({ email: "", password: "" })
    const [errorInputs, setErrorInputs] = useState({ loginError: false, passwordError: false })
    const { signIn, loading } = useAuth()

    const login = () => {
        let validInfos = validateInputs()
        if (validInfos) {
            signIn(loginInfos)
        }
    }

    const handleLoginInfos = (event: any) => {
        if (event.target.name == "email") {
            loginInfos.email = event.target.value
        } else if (event.target.name == "password") {
            loginInfos.password = event.target.value
        }

        setLoginInfos({ ...loginInfos })
    }

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

    return <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: "center",
            width: "100%",
            height: "95vh",
        }}
    >
        <Box
            sx={{
                backgroundColor: "#f5faffde",
                minWidth: 300,
                py: 6,
                px: 2,
                boxShadow: 2,
                borderRadius: 1.5
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
                        <Link href="/auth/forget-password">
                            Esqueceu a senha?
                        </Link>
                    </Grid>
                    <Grid item>
                        <Link href="/auth/create-account">
                            {"Criar uma conta"}
                        </Link>
                    </Grid>
                </Grid>
            </Box>
            <Box sx={{ mt: 8, mb: 4 }}>
                <Copyright />
            </Box>

        </Box>
    </Box>
}