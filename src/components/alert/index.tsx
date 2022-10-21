import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import React from 'react';
import { useAlert } from '../../hooks/useAlert';

interface alertProps {
    openAlert: boolean;
    alertMessage: string;
    severity: "error" | "warning" | "info" | "success";
    handleCloseAlert(): void;
}

export const AlertComponent = ({ openAlert, alertMessage, severity, handleCloseAlert }: alertProps) => {
    const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
        props,
        ref,
    ) {
        return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
    });

    return <Snackbar open={openAlert} autoHideDuration={3000} onClose={handleCloseAlert}>
        <Alert onClose={handleCloseAlert} severity={severity} sx={{ width: '100%' }}>
            {alertMessage}
        </Alert>
    </Snackbar>
}