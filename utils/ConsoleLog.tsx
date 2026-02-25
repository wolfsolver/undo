import config from '../app.json';

export const log = (section: string, message: string) => {
    console.log(`[${config.name}/${section}] ${message}`);
}