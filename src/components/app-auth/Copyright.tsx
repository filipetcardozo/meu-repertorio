import { Typography } from "@mui/material";
import Link from "next/link";

export const Copyright = () => {
    return (
        <Typography variant="body2" color="text.secondary" align="center">
            {'Copyright © '}
            <Link color="inherit" href="https://www.linkedin.com/in/filipe-cardozo-b5388a190/" target="_blank">
                Filipe Cardozo
            </Link>{' '}
            {new Date().getFullYear()}
            {'.'}
        </Typography>
    );
}