import { Box, Grid, InputLabel, Select, TextField, Typography } from "@mui/material"
import MenuItem from '@mui/material/MenuItem';
import React, { useState } from "react"

export const CreateAccountCredentialInfos = () => {
    const [errorInputs, setErrorInputs] = useState({ loginError: false, passwordError: false })

    return <>
        <Grid container columnSpacing={2} sx={{ mt: 1 }}>
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
        </Grid>
    </>
}