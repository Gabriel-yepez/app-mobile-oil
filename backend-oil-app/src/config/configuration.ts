// Solo el alias de tipo. Deliberadamente SIN una función que lea process.env:
// ConfigModule ya guarda lo que devuelve validateEnv, así que ConfigService
// entrega valores validados y convertidos. Una función que leyera process.env
// en crudo devolvería strings sin validar y burlaría esa garantía.
export type { EnvVars as AppConfig } from './env.validation';
