export interface DatabaseConfig {
    port: number;
    difyApiUrl: string;
}

export default (): DatabaseConfig => ({
    port: parseInt(process.env.PORT || '3000', 10),
    difyApiUrl: process.env.DIFY_API_URL || 'https://api.dify.ai/v1',
});