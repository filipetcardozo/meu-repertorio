import LoadingButton from "@mui/lab/LoadingButton"
import { Box, Grid, InputLabel, Select, TextField, Typography } from "@mui/material"
import Link from "next/link"
import React, { useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { Copyright } from "./Copyright"
import MenuItem from '@mui/material/MenuItem';

interface LoginInfosInterface {
    email: string;
    password: string;
}
export const CreateAccountComponent = () => {
    const [accountInfos, setAccountInfos] = useState<LoginInfosInterface>({ email: "", password: "" })
    const [errorInputs, setErrorInputs] = useState({ loginError: false, passwordError: false })
    const { signIn, loading, signUp } = useAuth()

    const login = () => {
        let validInfos = validateInputs()
        if (validInfos) {
            signIn(accountInfos)
        }
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

        let emailIsValid = validateEmail(accountInfos.email)
        if (!emailIsValid) {
            errorInputs.loginError = true
        } else {
            errorInputs.loginError = false
        }

        let passwordIsValid = validatePassword(accountInfos.password)
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
                width: "90%",
                maxWidth: 600,
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
            <Grid container columnSpacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                    <InputLabel id="demo-simple-select-label">
                        Quais são os estilos de músicas preferidas por você?
                    </InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        size="small"
                        fullWidth
                    // {/* value={age} */}
                    // label="Age"
                    // onChange={handleChange}
                    >
                        <MenuItem value={10}>Ten</MenuItem>
                        <MenuItem value={20}>Twenty</MenuItem>
                        <MenuItem value={30}>Thirty</MenuItem>
                    </Select>

                </Grid>
                <Grid item xs={12}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        label="Você toca por?"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        label="Qual a sua necessidade de visualizar cifras para tocar?"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        label="A quantos anos você toca?"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        label="Quais instrumentos você toca?"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        label="Nome"
                        fullWidth
                        autoComplete="off"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        label="Sobrenome"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        fullWidth
                        label="Email"
                        autoFocus
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.passwordError}
                        helperText={errorInputs.passwordError ? "Senha inválida." : ""}
                        margin="normal"
                        fullWidth
                        label="Senha"
                        type="password"
                        autoComplete="off"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        onChange={(e) => {

                        }}
                        error={errorInputs.loginError}
                        helperText={errorInputs.loginError ? "Email inválido." : ""}
                        margin="normal"
                        fullWidth
                        label="Cep"
                        autoFocus
                    />
                </Grid>
                {/* <FormControlLabel
                        control={<Checkbox value="remember" color="primary" />}
                        label="Manter logado"
                    /> */}

            </Grid>
            <LoadingButton
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                onClick={() => login()}
                loading={loading}
            >
                Criar Conta
            </LoadingButton>
            <Grid container>
                <Grid item xs>
                    <Link href="/auth/login">
                        Já tem conta?
                    </Link>
                </Grid>
            </Grid>
            <Box sx={{ mt: 8, mb: 4 }}>
                <Copyright />
            </Box>
        </Box>
    </Box >
}