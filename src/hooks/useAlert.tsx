import { useState } from 'react'

export const useAlert = () => {
    const [alertMessage, setAlertMessage] = useState("")
    const [severity, setSeverity] = useState<"error" | "warning" | "info" | "success">("info")
    const [openAlert, setOpenAlert] = useState(false)

    const handleCloseAlert = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpenAlert(false);
    };

    interface callOpenAlertInterface {
        severity: "error" | "warning" | "info" | "success";
        alertMessage: string;
    }

    function callOpenAlert({ severity, alertMessage }: callOpenAlertInterface) {
        console.log('here')
        setSeverity(severity)
        setAlertMessage(alertMessage)
        setOpenAlert(true)
    }

    return {
        alertMessage,
        severity,
        openAlert,
        setAlertMessage,
        setSeverity,
        setOpenAlert,
        handleCloseAlert,
        callOpenAlert
    }
}