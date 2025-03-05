export interface DatabaseConfig {
    port: number;
}

export default (): DatabaseConfig => ({
    port: parseInt(process.env.PORT || '3000', 10),
});