import { useEffect, useState, useMemo } from 'react';
import { useHits } from 'react-instantsearch-hooks-web';
import { useSearchBox } from 'react-instantsearch-hooks-web';

export const useSearchAlgolia = () => {
  const [valueToSearch, setValueToSearch] = useState("")
  const { refine } = useSearchBox();
  const { hits, results } = useHits();
  const [page, setPage] = useState(0);
  const [updatingSearch, setUpdatingSearch] = useState(false)

  const numberOfPages = useMemo(() => {
    return results?.nbPages
  }, [results])

  useEffect(() => {
    const timer = setTimeout(() => {
      refine(valueToSearch)
      setUpdatingSearch(false)
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueToSearch])

  const handleChangePage = (event: any, value: any) => {
    setPage(value - 1);
  };

  return {
    hits,
    page,
    valueToSearch,
    updatingSearch,
    numberOfPages,
    setValueToSearch,
    handleChangePage,
    setUpdatingSearch
  }
}