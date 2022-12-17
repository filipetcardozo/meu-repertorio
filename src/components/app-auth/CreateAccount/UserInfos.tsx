import { Box, Grid, InputLabel, Select, TextField, Typography } from "@mui/material"
import MenuItem from '@mui/material/MenuItem';
import React, { useState, useEffect } from "react"
import { useAuth } from "../../../hooks/useAuth";
import { useFormik } from 'formik';
import Autocomplete from '@mui/material/Autocomplete';
import { FormControl } from '@mui/material';

interface LoginInfosInterface {
    email: string;
    password: string;
}

const musicStyles = [
    "Rock",
    "Golpel/Religioso",
    "Sertanejo",
    "Pop Rock",
    "Rock and Roll",
    "MPB",
    "POP",
    "Reggae",
    "Pagode",
    "Samba",

    "Alternativo",
    "Axé",
    "Blues",
    "Bolero",
    "Bossa Nova",
    "Brega",
    "Clássico",
    "Country",
    "Cuarteto",
    "Cumbia",
    "Dance",
    "Disco",
    "Eletrônica",
    "Emocore",
    "Fado",
    "Folk",
    "Forró",
    "Funk",
    "Funk Internacional",
    "Grunge",
    "Guarânia",
    "Gótico",
    "Hard Rock",
    "Hardcore",
    "Heavy Metal",
    "Hip Hop/Rap",
    "House",
    "Indie",
    "Industrial",
    "Infantil",
    "J-Pop/J-Rock",
    "Jazz",
    "Jovem Guarda",
    "K-Pop",
    "Mambo",
    "Marchas/Hinos",
    "Mariachi",
    "Merengue",
    "Música andina",
    "New Age",
    "New Wave",
    "Pop",
    "Post-Rock",
    "Power-Pop",
    "Psicodelia",
    "Punk Rock",
    "R&B",
    "Ranchera",
    "Reggaeton",
    "Regional",
    "Rock Progressivo",
    "Rockabilly",
    "Romântico",
    "Salsa",
    "Samba Enredo",
    "Ska",
    "Soft Rock",
    "Soul",
    "Surf Music",
    "Tango",
    "Tecnopop",
    "Trova",
    "Velha Guarda",
    "World Music",
    "Zamba",
    "Zouk"
]

export const CreateAccountUserInfos = () => {
    const form = useFormik({
        initialValues: {
            styles: "",
            hobbyOrProfessionally: "",
            needVisualizeLyrics: ""
        },
        onSubmit: values => {
            console.log(values)
        }
    })

    // useEffect(() => {
    //     // axios.get("https://www.googleapis.com/youtube/v3/videos?id=xx&part=statistics&key=xx")
    //     // .then(v => console.log(v.data))
    //     fetch('/api/youtubeIdLyric')
    //         .then(v => v.json())
    //         .then(v => console.log(v))
    //         .catch((er) => console.log("error"))
    // }, [])

    useEffect(() => {
        console.log(form.values)
    }, [form.values])

    return <>
        <form onSubmit={form.handleSubmit}>
            <Grid rowGap={4} container columnSpacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                    <Autocomplete
                        multiple
                        id="musicStyles"
                        options={musicStyles}
                        disableCloseOnSelect={true}
                        onChange={(event, newValue) => { form.setFieldValue("styles", newValue) }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Quais são os estilos de músicas preferidos por você?"
                                size="small"
                            />
                        )}
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="hobbyOrProfessionally">
                            Você toca Profissionalmente ou por Hobby?
                        </InputLabel>
                        <Select

                            id="hobbyOrProfessionally"
                            labelId="hobbyOrProfessionally"
                            name="hobbyOrProfessionally"
                            label="Você toca Profissionalmente ou por Hobby?"
                            onChange={form.handleChange}
                            value={form.values.hobbyOrProfessionally}
                        >
                            <MenuItem value={"hobby"}>Hobby</MenuItem>
                            <MenuItem value={"profissionally"}>Profissionalmente</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="needVisualizeLyrics">
                            Qual a sua necessidade de visualizar as cifras de uma música para tocar?
                        </InputLabel>
                        <Select
                            id="needVisualizeLyrics"
                            labelId="needVisualizeLyrics"
                            name="needVisualizeLyrics"
                            label="Qual a sua necessidade de visualizar as cifras de uma música para tocar?"
                            onChange={form.handleChange}
                            value={form.values.needVisualizeLyrics}
                        >
                            <MenuItem value={1}>1 - Não consigo tocar sem visualizar as cifras.</MenuItem>
                            <MenuItem value={2}>2 - Consigo tocar algumas músicas sem cifras, mas no geral prefiro visualizar.</MenuItem>
                            <MenuItem value={3}>3 - Não preciso visualizar as cifras, apenas gostaria de organizar meus repertórios.</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {/* 
                <Grid item xs={12}>
                    <InputLabel id="demo-simple-select-label">
                        Qual a sua necessidade de visualizar as cifras de uma música para tocar?
                    </InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        size="small"
                        fullWidth
                    >
                        <MenuItem value={1}>1 - Não consigo tocar sem visualizar as cifras.</MenuItem>
                        <MenuItem value={2}>2 - Consigo tocar algumas músicas sem cifras, mas no geral prefiro visualizar.</MenuItem>
                        <MenuItem value={3}>3 - Não preciso visualizar as cifras, apenas gostaria de organizar meus repertórios.</MenuItem>
                    </Select>
                </Grid>
                <Grid item xs={12}>
                    <InputLabel id="demo-simple-select-label">
                        A quantos anos você toca?
                    </InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        size="small"
                        fullWidth
                    >
                        <MenuItem value={1}>Menos de 2 anos</MenuItem>
                        <MenuItem value={1}>Entre 2 e 4 anos</MenuItem>
                        <MenuItem value={1}>Entre 4 e 6 anos</MenuItem>
                        <MenuItem value={1}>Mais de 6 anos</MenuItem>
                    </Select>
                </Grid>
                <Grid item xs={12}>
                    <InputLabel id="demo-simple-select-label">
                        Quais instrumentos você toca?
                    </InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        size="small"
                        fullWidth
                    >
                        <MenuItem value={1}>Violão</MenuItem>
                        <MenuItem value={1}>Guitarra</MenuItem>
                        <MenuItem value={1}>Teclado</MenuItem>
                        <MenuItem value={1}>Baixo</MenuItem>
                        <MenuItem value={1}>Ukulele</MenuItem>
                    </Select>
                </Grid> */}
            </Grid>
        </form>
    </>
}