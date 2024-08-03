/**
 * Returns a full URL from a path.
 * 
 * @param {string} path The page path
 * @returns {string} The full URL
 */
export function genUrl(path) {
    const url = new URL(path, "https://juxt.pretendo.network");
    return url.href;
}