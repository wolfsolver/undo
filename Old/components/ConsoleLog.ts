import config from '../PluginConfig.json';

export const log = (section: string, message: string) => {
    console.log(`[${config.name}/${section}] ${message}`);
}