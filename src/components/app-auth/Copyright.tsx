import { Typography } from "@mui/material";
import Link from "next/link";

export const Copyright = () => {
    return (
        <Typography sx={{ color: 'text.secondary', '& a': { color: 'inherit' } }} variant="body2" align="center">
            {'Copyright © '}
            <Link href="https://www.linkedin.com/in/filipe-cardozo-b5388a190/" target="_blank">
                Filipe Cardozo
            </Link>{' '}
            {new Date().getFullYear()}
            {'.'}
        </Typography>
    );
}