import { createContext, useContext } from 'react';

/**
 * No mobile o AppBar some ao rolar para baixo e volta ao rolar para cima.
 * Elementos "sticky" abaixo dele (ex.: barra do repertório) usam isso para subir junto.
 */
export const AppBarHiddenContext = createContext(false);

export const useAppBarHidden = () => useContext(AppBarHiddenContext);
