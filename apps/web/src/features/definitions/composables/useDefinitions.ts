/** Suites and configs from the repo's YAML files. */
import { useQuery } from '@tanstack/vue-query';
import { api } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';

export function useDefinitions() {
  return useQuery({ queryKey: queryKeys.definitions, queryFn: api.definitions });
}
